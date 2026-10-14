/** Waterfalls: scrolling canvas textures on planes with a mist halo. Pure effect, kept procedural. */
import { CanvasTexture, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping } from 'three';
import { glowSprite } from '../render/Glow';
import { PALETTE } from '../render/palette';
import type { Landmark } from './Landmarks';

function fallTexture(w: number, h: number, base: string, streak: string, streaks: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = streak;
  for (let i = 0; i < streaks; i++) ctx.fillRect(i * (w / streaks) * 1.1, (i * 13) % h, 1, h * 0.28 + ((i * 7) % (h * 0.3)));
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

/** Blue waterfall pouring down a cliff. */
export function waterfall(x: number, z: number, topY: number, width: number, height: number): Landmark {
  const tex = fallTexture(8, 64, 'rgba(79,124,255,0.35)', 'rgba(223,230,255,0.9)', 6);
  tex.repeat.set(width / 2, height / 8);
  const mesh = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: tex, transparent: true, side: DoubleSide, depthWrite: false, fog: true, color: new Color(1.3, 1.35, 1.6), toneMapped: false }));
  mesh.position.set(x, topY - height / 2, z);
  const mist = glowSprite(PALETTE.electric, width * 1.6, 0.35, true);
  mist.position.set(x, topY - height + 3, z);
  const g = new Group();
  g.add(mesh, mist);
  return { object: g, footprints: [], update(dt) { tex.offset.y += dt * 0.9; } };
}

/** Teal falls spilling off the giant mushrooms. */
export function tealFalls(spots: Array<{ x: number; z: number; top: number; height: number; width: number }>): Landmark {
  const g = new Group();
  const mats: MeshBasicMaterial[] = [];
  for (const s of spots) {
    const tex = fallTexture(16, 128, 'rgba(55,245,255,0.3)', 'rgba(220,255,255,0.9)', 9);
    tex.repeat.set(s.width / 2, s.height / 10);
    const mat = new MeshBasicMaterial({ map: tex, transparent: true, side: DoubleSide, depthWrite: false, color: new Color(1.0, 1.6, 1.7), toneMapped: false });
    const mesh = new Mesh(new PlaneGeometry(s.width, s.height), mat);
    mesh.position.set(s.x, s.top - s.height / 2, s.z);
    const mist = glowSprite(PALETTE.rune, s.width * 2.2, 0.35, true);
    mist.position.set(s.x, s.top - s.height + 2, s.z);
    g.add(mesh, mist);
    mats.push(mat);
  }
  return { object: g, footprints: [], update(dt) { for (const m of mats) (m.map as CanvasTexture).offset.y += dt * 1.1; } };
}
