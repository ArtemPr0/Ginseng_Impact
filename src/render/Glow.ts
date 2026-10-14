import { AdditiveBlending, CanvasTexture, Sprite, SpriteMaterial } from 'three';

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
  return glowTex;
}

export function glowSprite(color: number, scale: number, opacity = 0.7, fog = false): Sprite {
  const s = new Sprite(new SpriteMaterial({ map: glowTexture(), color, blending: AdditiveBlending, transparent: true, opacity, depthWrite: false, fog }));
  s.scale.setScalar(scale);
  return s;
}
