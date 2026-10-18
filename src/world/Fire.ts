import { AdditiveBlending, BufferAttribute, BufferGeometry, Float32BufferAttribute, Group, PointLight, Points, PointsMaterial } from 'three';
import { glowSprite, glowTexture } from '../render/Glow';

export const FIRE = 0xff7a2a;
export const EMBER = 0xff3a10;

/** The purple flames of the Lean Quarter's torches and braziers (DeaqHWJBBPw, Def4LDkxikA): `fire(..., PURPLE_FIRE)`. */
export const PURPLE_FIRE = { core: 0xa64dff, inner: 0xf0c8ff, ember: 0x7a2cff };

/**
 * Fire: emissive core sprite, point light with flicker, rising embers. Pure VFX (no mesh). `colors` recolours it
 * (PURPLE_FIRE); the default is a warm orange flame.
 */
export function fire(x: number, y: number, z: number, scale = 1, intensity = 18, colors?: { core: number; inner: number; ember: number }): { group: Group; update: (dt: number) => void } {
  const g = new Group();
  const core = glowSprite(colors?.core ?? FIRE, 1.6 * scale, 0.9, true);
  // (Flames by the river and the eye are drawn after the water, which would otherwise cover them.)
  core.renderOrder = 6;
  core.position.set(x, y + 0.5 * scale, z);
  const inner = glowSprite(colors?.inner ?? 0xfff0a0, 0.7 * scale, 0.9, true);
  inner.renderOrder = 6;
  inner.position.set(x, y + 0.35 * scale, z);
  // Small flames (candles, lanterns) are emissive only: dozens of point lights would sink the frame rate.
  const light = new PointLight(colors?.core ?? FIRE, intensity, 12 * scale, 1.8);
  light.position.set(x, y + 1.2 * scale, z);
  light.visible = intensity >= 6;
  const n = 24;
  const pos: number[] = [];
  const seeds: number[] = [];
  for (let i = 0; i < n; i++) { pos.push(x, y, z); seeds.push(Math.random()); }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const embers = new Points(geo, new PointsMaterial({ map: glowTexture(), color: colors?.ember ?? EMBER, size: 0.22 * scale, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }));
  embers.renderOrder = 6;
  embers.frustumCulled = false;
  g.add(core, inner, embers);
  if (intensity >= 6) g.add(light);
  const attr = geo.attributes.position as BufferAttribute;
  let t = 0;
  return {
    group: g,
    update(dt) {
      t += dt;
      const f = 0.85 + Math.sin(t * 17) * 0.08 + Math.sin(t * 31 + 1) * 0.07;
      light.intensity = intensity * f;
      core.scale.setScalar(1.6 * scale * (0.9 + Math.sin(t * 13) * 0.1));
      for (let i = 0; i < n; i++) {
        const life = (t * (0.4 + seeds[i] * 0.5) + seeds[i] * 10) % 1;
        attr.setXYZ(i, x + Math.sin(t * 2 + seeds[i] * 30) * 0.25 * scale * life, y + life * 2.4 * scale, z + Math.cos(t * 1.7 + seeds[i] * 20) * 0.25 * scale * life);
      }
      attr.needsUpdate = true;
    },
  };
}
