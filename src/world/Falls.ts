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
  const mesh = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: tex, transparent: true, side: DoubleSide, forceSinglePass: true, depthWrite: false, fog: true, color: new Color(1.3, 1.35, 1.6), toneMapped: false }));
  mesh.position.set(x, topY - height / 2, z);
  const mist = glowSprite(PALETTE.electric, width * 1.6, 0.35, true);
  mist.position.set(x, topY - height + 3, z);
  const g = new Group();
  g.add(mesh, mist);
  return { object: g, footprints: [], update(dt) { tex.offset.y += dt * 0.9; } };
}

