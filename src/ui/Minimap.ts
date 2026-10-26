import { LAYOUT } from '../data/world';
import { WORLD, type Terrain } from '../world/Terrain';

const SIZE = 160;
const RANGE = 150; // metres from centre to the map edge
/** Beyond the island's baked square (its own void colour). */
const ISLAND_VOID = '#05060f';
/** The HUD panels' navy (--panel, opaque): the void round a realm's ground. */
const PANEL = '#0a0f2e';

/** A place the map can show besides the island: a realm (data/world REALMS) round (x, z), `radius` each way, floor `y`. */
export interface MapZone { id: string; x: number; z: number; y: number; radius: number }

/** One realm's bake: the square it covers (centre and side, metres), pixels per side, and the floor it shades from. */
export interface ZoneBake { id: string; cx: number; cz: number; span: number; res: number; floorY: number }

export function zoneBakeSpec(zone: MapZone, res = 160): ZoneBake {
  return { id: zone.id, cx: zone.x, cz: zone.z, span: zone.radius * 2, res, floorY: zone.y };
}

/** Deeper than this under a realm's floor is the void round it (the panel shows through). */
const VOID_BELOW = 12;
/** Standing this high over the floor is a wall or a building (drawn pale). */
const STRUCTURE = 2.5;

/**
 * A realm's ground as RGBA pixels, row j going +z and column i going +x (as the island's bake): the void round it
 * transparent, floors shaded by their height over the realm's floor like the island's land, walls and buildings pale.
 */
export function bakeZonePixels(spec: ZoneBake, heightAt: (x: number, z: number) => number, out = new Uint8ClampedArray(spec.res * spec.res * 4)): Uint8ClampedArray {
  const { res, span, cx, cz, floorY } = spec;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = cx + ((i + 0.5) / res - 0.5) * span;
      const z = cz + ((j + 0.5) / res - 0.5) * span;
      const h = heightAt(x, z) - floorY;
      const k = (j * res + i) * 4;
      if (!(h >= -VOID_BELOW)) { out[k] = out[k + 1] = out[k + 2] = out[k + 3] = 0; continue; }
      if (h > STRUCTURE) { out[k] = 120; out[k + 1] = 132; out[k + 2] = 196; out[k + 3] = 255; continue; }
      const t = Math.min(1, Math.max(0, (h + 6) / 10));
      out[k] = 28 + t * 30; out[k + 1] = 40 + t * 30; out[k + 2] = 110 + t * 60; out[k + 3] = 255;
    }
  }
  return out;
}

/** Bakes kept by zone id: each realm is baked the first time the map shows it (again only after `drop`). */
export class ZoneBakes<T> {
  private readonly cache = new Map<string, T>();

  get(id: string, bake: () => T): T {
    let v = this.cache.get(id);
    if (v === undefined) {
      v = bake();
      this.cache.set(id, v);
    }
    return v;
  }

  has(id: string): boolean {
    return this.cache.has(id);
  }

  /** Forgets one zone's bake (its ground changed), or every one. */
  drop(id?: string): void {
    if (id === undefined) this.cache.clear();
    else this.cache.delete(id);
  }
}

/** Circular minimap that rotates with the camera: terrain image cache, causeway, landmarks, enemies, player chevron. */
export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly terrainImage: HTMLCanvasElement;
  private readonly mapSpan = 600;
  private readonly bakes = new ZoneBakes<{ image: HTMLCanvasElement; spec: ZoneBake }>();
  /** The realm shown (null: the island). */
  private zone: { image: HTMLCanvasElement; spec: ZoneBake } | null = null;
  private zoneId: string | null = null;

  constructor(container: HTMLElement, terrain: Terrain) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.canvas.className = 'hud-minimap';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.terrainImage = this.bakeTerrain(terrain);
  }

  /**
   * Shows the island (null) or a realm, whose ground is baked from `world.heightAt` over its square the first time
   * (cached by zone id). Cheap to call every frame: only a change of zone does anything.
   */
  setZone(zone: MapZone | null, world: { heightAt(x: number, z: number): number }): void {
    const id = zone?.id ?? null;
    if (id === this.zoneId) return;
    this.zoneId = id;
    this.zone = zone ? this.bakes.get(zone.id, () => this.bakeZone(zoneBakeSpec(zone), world)) : null;
  }

  private bakeZone(spec: ZoneBake, world: { heightAt(x: number, z: number): number }): { image: HTMLCanvasElement; spec: ZoneBake } {
    const c = document.createElement('canvas');
    c.width = c.height = spec.res;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(spec.res, spec.res);
    bakeZonePixels(spec, (x, z) => world.heightAt(x, z), img.data);
    ctx.putImageData(img, 0, 0);
    return { image: c, spec };
  }

  private bakeTerrain(terrain: Terrain): HTMLCanvasElement {
    const res = 160;
    const c = document.createElement('canvas');
    c.width = c.height = res;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(res, res);
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const x = (i / res - 0.5) * this.mapSpan;
        const z = (j / res - 0.5) * this.mapSpan;
        const h = terrain.heightAt(x, z);
        const k = (j * res + i) * 4;
        let r = 5, g = 6, b = 15;
        if (h > WORLD.cloudSeaY) { r = 20; g = 28; b = 80; }
        if (h > -2) { const t = Math.min(1, (h + 2) / 14); r = 28 + t * 30; g = 40 + t * 30; b = 110 + t * 60; }
        if (Math.abs(x - LAYOUT.causeway.x) < 3.5 && z < LAYOUT.causeway.zStart && z > LAYOUT.causeway.zEnd) { r = 140; g = 150; b = 210; }
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  draw(px: number, pz: number, cameraYaw: number, enemies: Iterable<{ x: number; z: number; alive: boolean; aggro: boolean; boss?: boolean }>, revealBosses = false, npcs: Iterable<{ x: number; z: number }> = []): void {
    const ctx = this.ctx;
    const r = SIZE / 2;
    const zone = this.zone;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = zone ? PANEL : ISLAND_VOID;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // World → map: translate so the player is centred, rotate so camera-forward (−z rotated by yaw) points up.
    ctx.translate(r, r);
    ctx.rotate(cameraYaw);
    const scale = r / RANGE;
    ctx.imageSmoothingEnabled = false;
    if (zone) {
      const { cx, cz, span } = zone.spec;
      ctx.drawImage(zone.image, (cx - span / 2 - px) * scale, (cz - span / 2 - pz) * scale, span * scale, span * scale);
    } else {
      const imgScale = (this.mapSpan / this.terrainImage.width) * scale;
      ctx.drawImage(this.terrainImage, (-this.mapSpan / 2 - px) * scale, (-this.mapSpan / 2 - pz) * scale, this.terrainImage.width * imgScale, this.terrainImage.height * imgScale);
    }
    const dot = (x: number, z: number, color: string, size: number) => {
      ctx.fillStyle = color;
      ctx.fillRect((x - px) * scale - size / 2, (z - pz) * scale - size / 2, size, size);
    };
    if (!zone) {
      dot(LAYOUT.head.x, LAYOUT.head.z, '#ff2a2a', 6);
      dot(LAYOUT.cathedral.x, LAYOUT.cathedral.z, '#37f5ff', 5);
    }
    for (const n of npcs) dot(n.x, n.z, '#dfe6ff', 2);
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.boss) { if (revealBosses || e.aggro) dot(e.x, e.z, '#ff2a2a', 7); }
      else dot(e.x, e.z, e.aggro ? '#ff2a2a' : '#8d99d6', 3);
    }
    ctx.restore();
    // Player chevron, always pointing up (camera-forward).
    ctx.save();
    ctx.translate(r, r);
    ctx.fillStyle = '#4f7cff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(223,230,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(r, r, r - 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}
