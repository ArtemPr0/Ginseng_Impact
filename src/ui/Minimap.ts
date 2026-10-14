import { LAYOUT } from '../data/world';
import { WORLD, type Terrain } from '../world/Terrain';

const SIZE = 160;
const RANGE = 150; // metres from centre to the map edge

/** Circular minimap that rotates with the camera: terrain image cache, causeway, landmarks, enemies, player chevron. */
export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly terrainImage: HTMLCanvasElement;
  private readonly mapSpan = 600;

  constructor(container: HTMLElement, terrain: Terrain) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.canvas.className = 'hud-minimap';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.terrainImage = this.bakeTerrain(terrain);
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
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // World → map: translate so the player is centred, rotate so camera-forward (−z rotated by yaw) points up.
    ctx.translate(r, r);
    ctx.rotate(cameraYaw);
    const scale = r / RANGE;
    ctx.imageSmoothingEnabled = false;
    const imgScale = (this.mapSpan / this.terrainImage.width) * scale;
    ctx.drawImage(this.terrainImage, (-this.mapSpan / 2 - px) * scale, (-this.mapSpan / 2 - pz) * scale, this.terrainImage.width * imgScale, this.terrainImage.height * imgScale);
    const dot = (x: number, z: number, color: string, size: number) => {
      ctx.fillStyle = color;
      ctx.fillRect((x - px) * scale - size / 2, (z - pz) * scale - size / 2, size, size);
    };
    dot(LAYOUT.head.x, LAYOUT.head.z, '#ff2a2a', 6);
    dot(LAYOUT.cathedral.x, LAYOUT.cathedral.z, '#37f5ff', 5);
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
