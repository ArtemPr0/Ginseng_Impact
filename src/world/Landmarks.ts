import {
  AdditiveBlending, BoxGeometry, CanvasTexture, ConeGeometry, Group, Mesh, MeshBasicMaterial, NearestFilter,
  PlaneGeometry, PointLight, RepeatWrapping, SphereGeometry, Sprite, SpriteMaterial, DoubleSide,
} from 'three';
import { PALETTE } from '../render/palette';
import { ps1Lambert } from '../render/PS1Material';
import type { Footprint } from './Colliders';

export interface Landmark {
  object: Group;
  footprints: Footprint[];
  update?(dt: number): void;
}

const STONE_LIGHT = 0x5a6aa8;
const STONE_DARK = 0x323d6e;

function stoneBox(w: number, h: number, d: number, color: number = PALETTE.stone): Mesh {
  return new Mesh(new BoxGeometry(w, h, d), ps1Lambert({ color }));
}

let glowTex: CanvasTexture | undefined;
/** Radial glow used for every emissive halo. */
export function glowTexture(): CanvasTexture {
  if (glowTex) return glowTex;
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTex = new CanvasTexture(canvas);
  glowTex.minFilter = glowTex.magFilter = NearestFilter;
  return glowTex;
}

export function glowSprite(color: number, scale: number, opacity = 0.7, fog = false): Sprite {
  const s = new Sprite(new SpriteMaterial({ map: glowTexture(), color, blending: AdditiveBlending, transparent: true, opacity, depthWrite: false, fog }));
  s.scale.setScalar(scale);
  return s;
}

/** A standing stone: tall box with a cap. Walkable top, climbable sides. */
export function monolith(x: number, z: number, baseY: number, w: number, h: number, d: number, rotY = 0): Landmark {
  const g = new Group();
  const stone = stoneBox(w, h, d);
  stone.position.y = h / 2;
  const cap = stoneBox(w * 0.8, h * 0.08, d * 0.8, STONE_LIGHT);
  cap.position.y = h + h * 0.04;
  g.add(stone, cap);
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;
  return { object: g, footprints: [{ kind: 'box', x, z, hw: w / 2, hd: d / 2, top: baseY + h, rotY }] };
}

export interface CausewayConfig {
  x: number; zStart: number; zEnd: number; width: number; yStart: number; yEnd: number; postSpacing: number; segmentLength: number;
}

/** Straight raised road in one-point perspective: stepped slab segments, piers over the chasm, broken balustrade posts, stairs at the south end. */
export function causeway(cfg: CausewayConfig, groundAt: (x: number, z: number) => number, rnd: () => number): Landmark {
  const g = new Group();
  const footprints: Footprint[] = [];
  const length = cfg.zStart - cfg.zEnd;
  const n = Math.ceil(length / cfg.segmentLength);
  const segLen = length / n;
  const deckMat = ps1Lambert({ color: STONE_LIGHT });
  const wallMat = ps1Lambert({ color: PALETTE.stone });
  const pierMat = ps1Lambert({ color: STONE_DARK });
  for (let i = 0; i < n; i++) {
    const zc = cfg.zStart - (i + 0.5) * segLen;
    const top = cfg.yStart + ((cfg.yEnd - cfg.yStart) * (i + 0.5)) / n;
    const deck = new Mesh(new BoxGeometry(cfg.width, 0.3, segLen), deckMat);
    deck.position.set(cfg.x, top - 0.15, zc);
    const body = new Mesh(new BoxGeometry(cfg.width + 0.6, 3, segLen), wallMat);
    body.position.set(cfg.x, top - 1.8, zc);
    g.add(deck, body);
    const ground = groundAt(cfg.x, zc);
    if (ground < top - 4) {
      const pierH = top - 3 - Math.max(ground, -95);
      const pier = new Mesh(new BoxGeometry(cfg.width * 0.7, pierH, segLen * 0.45), pierMat);
      pier.position.set(cfg.x, top - 3 - pierH / 2, zc);
      g.add(pier);
    }
    footprints.push({ kind: 'box', x: cfg.x, z: zc, hw: cfg.width / 2 + 0.3, hd: segLen / 2, top });
  }
  // Balustrade posts, some broken or missing.
  const postMat = ps1Lambert({ color: PALETTE.stone });
  for (let z = cfg.zStart - 2; z > cfg.zEnd + 2; z -= cfg.postSpacing) {
    const t = (cfg.zStart - z) / length;
    const top = cfg.yStart + (cfg.yEnd - cfg.yStart) * t;
    for (const side of [-1, 1]) {
      const r = rnd();
      if (r < 0.28) continue;
      const h = r < 0.55 ? 0.5 + rnd() * 0.6 : 1.6;
      const post = new Mesh(new BoxGeometry(0.7, h, 0.7), postMat);
      const px = cfg.x + side * (cfg.width / 2 + 0.05);
      post.position.set(px, top + h / 2, z);
      g.add(post);
      footprints.push({ kind: 'box', x: px, z, hw: 0.35, hd: 0.35, top: top + h });
    }
  }
  // Stairs at the south end down to the ground.
  const groundS = groundAt(cfg.x, cfg.zStart + 6);
  const steps = Math.max(1, Math.ceil((cfg.yStart - groundS) / 0.45));
  for (let i = 1; i <= steps; i++) {
    const top = cfg.yStart - i * 0.45;
    const zc = cfg.zStart + i * 1.1 - 0.55;
    const step = new Mesh(new BoxGeometry(cfg.width, 3, 1.1), wallMat);
    step.position.set(cfg.x, top - 1.5, zc);
    g.add(step);
    footprints.push({ kind: 'box', x: cfg.x, z: zc, hw: cfg.width / 2, hd: 0.55, top });
  }
  return { object: g, footprints };
}

/** Colossal buried stone head facing +z with blood-red eyes that shine through the fog. */
export function giantHead(x: number, z: number, baseY: number, H: number): Landmark {
  const g = new Group();
  const jaw = stoneBox(0.62 * H, 0.28 * H, 0.62 * H, STONE_DARK);
  jaw.position.y = 0.14 * H;
  const face = stoneBox(0.72 * H, 0.58 * H, 0.75 * H);
  face.position.y = 0.57 * H;
  const crown = stoneBox(0.6 * H, 0.16 * H, 0.62 * H, STONE_DARK);
  crown.position.y = 0.94 * H;
  const front = 0.375 * H;
  const brow = stoneBox(0.74 * H, 0.06 * H, 0.1 * H, STONE_LIGHT);
  brow.position.set(0, 0.74 * H, front + 0.03 * H);
  const nose = stoneBox(0.12 * H, 0.22 * H, 0.1 * H, STONE_LIGHT);
  nose.position.set(0, 0.56 * H, front + 0.05 * H);
  const mouth = stoneBox(0.3 * H, 0.03 * H, 0.04 * H, PALETTE.void);
  mouth.position.set(0, 0.36 * H, front + 0.02 * H);
  g.add(jaw, face, crown, brow, nose, mouth);
  for (const side of [-1, 1]) {
    const socket = stoneBox(0.15 * H, 0.09 * H, 0.06 * H, PALETTE.void);
    socket.position.set(side * 0.19 * H, 0.69 * H, front + 0.01 * H);
    const eye = new Mesh(new SphereGeometry(0.035 * H, 6, 4), ps1Lambert({ color: PALETTE.void, emissive: PALETTE.blood, emissiveIntensity: 3, fog: false }));
    eye.position.set(side * 0.19 * H, 0.69 * H, front + 0.045 * H);
    const halo = glowSprite(PALETTE.blood, 0.28 * H, 0.75);
    halo.position.copy(eye.position);
    g.add(socket, eye, halo);
  }
  // Cracks.
  const crackPos: Array<[number, number, number, number]> = [[-0.2, 0.5, 0.02, 0.3], [0.25, 0.42, 0.015, 0.22], [0.05, 0.8, 0.02, 0.14], [-0.3, 0.3, 0.012, 0.18]];
  for (const [cx, cy, cw, ch] of crackPos) {
    const crack = stoneBox(cw * H, ch * H, 0.02 * H, PALETTE.void);
    crack.position.set(cx * H, cy * H, front + 0.004 * H);
    crack.rotation.z = (cx > 0 ? -1 : 1) * 0.3;
    g.add(crack);
  }
  g.position.set(x, baseY, z);
  return { object: g, footprints: [{ kind: 'box', x, z, hw: 0.36 * H, hd: 0.375 * H, top: baseY + 1.02 * H }] };
}

/** Cluster of gothic spires on a hall, with a rune-fire portal at the door. Walls are climbable. */
export function cathedral(x: number, z: number, baseY: number): Landmark {
  const g = new Group();
  const footprints: Footprint[] = [];
  const spires: Array<[number, number, number]> = [[0, 0, 118], [15, 7, 86], [-13, 9, 78], [7, -15, 66], [-9, -13, 58]];
  const slitMat = ps1Lambert({ color: PALETTE.void, emissive: PALETTE.rune, emissiveIntensity: 1.2 });
  for (const [dx, dz, h] of spires) {
    const w1 = h * 0.11;
    let y = 0;
    const widths = [w1, w1 * 0.78, w1 * 0.56];
    const heights = [h * 0.46, h * 0.3, h * 0.14];
    for (let t = 0; t < 3; t++) {
      const tier = stoneBox(widths[t], heights[t], widths[t], t === 2 ? STONE_LIGHT : PALETTE.stone);
      tier.position.set(dx, y + heights[t] / 2, dz);
      g.add(tier);
      if (t < 2) {
        for (let k = 0; k < 3; k++) {
          const slit = new Mesh(new BoxGeometry(widths[t] * 0.08, heights[t] * 0.18, 0.3), slitMat);
          slit.position.set(dx + (k - 1) * widths[t] * 0.28, y + heights[t] * (0.35 + 0.15 * (k % 2)), dz + widths[t] / 2 + 0.1);
          g.add(slit);
        }
      }
      y += heights[t];
    }
    const cap = new Mesh(new ConeGeometry(widths[2] * 0.75, h * 0.1, 4), ps1Lambert({ color: STONE_DARK }));
    cap.position.set(dx, y + h * 0.05, dz);
    cap.rotation.y = Math.PI / 4;
    g.add(cap);
    footprints.push({ kind: 'cyl', x: x + dx, z: z + dz, r: w1 * 0.55, top: baseY + y });
  }
  const hall = stoneBox(34, 16, 22, STONE_DARK);
  hall.position.set(0, 8, 2);
  g.add(hall);
  footprints.push({ kind: 'box', x, z: z + 2, hw: 17, hd: 11, top: baseY + 16 });
  const door = new Mesh(new BoxGeometry(3.2, 6.5, 0.4), ps1Lambert({ color: PALETTE.void, emissive: PALETTE.rune, emissiveIntensity: 2.5 }));
  door.position.set(0, 3.25, 13.3);
  const fire = glowSprite(PALETTE.rune, 12, 0.7, true);
  fire.position.set(0, 4, 14);
  const light = new PointLight(PALETTE.rune, 40, 18, 2);
  light.position.set(0, 4, 16);
  g.add(door, fire, light);
  g.position.set(x, baseY, z);
  return { object: g, footprints };
}

/** Vertical scrolling stripe plane, moon-white over electric. */
export function waterfall(x: number, z: number, topY: number, width: number, height: number): Landmark {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(79,124,255,0.35)';
  ctx.fillRect(0, 0, 8, 64);
  ctx.fillStyle = 'rgba(223,230,255,0.9)';
  for (let i = 0; i < 6; i++) ctx.fillRect(i * 1.4, (i * 13) % 64, 1, 18 + (i * 7) % 20);
  const tex = new CanvasTexture(canvas);
  tex.minFilter = tex.magFilter = NearestFilter;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(width / 2, height / 8);
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, side: DoubleSide, depthWrite: false, fog: true });
  const mesh = new Mesh(new PlaneGeometry(width, height), mat);
  mesh.position.set(x, topY - height / 2, z);
  const mist = glowSprite(PALETTE.electric, width * 1.6, 0.35, true);
  mist.position.set(x, topY - height + 3, z);
  const g = new Group();
  g.add(mesh, mist);
  return {
    object: g,
    footprints: [],
    update(dt) {
      tex.offset.y += dt * 0.9;
    },
  };
}
