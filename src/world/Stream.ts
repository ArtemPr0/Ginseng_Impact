/**
 * The witch stream: toxic green water winding down its ravine (a ribbon on the bed, flowing, foaming at the edges,
 * bubbling), the cauldron's green fire on the bridge, and the three coven witches, who throw poison orbs from their
 * staffs at anyone who comes near the bridge. Wading in it burns and poisons. The bridge deck is a walkway slab
 * (Walkways.ts) and the cauldron a Meshy model; this file is water, effects and characters.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, PointLight, Points,
  PointsMaterial, ShaderMaterial, Vector3,
} from 'three';
import { Rig } from '../characters/Rig';
import { yawToRotation } from '../models/ModelRig';
import { WITCH } from '../characters/roster';
import { glowSprite, glowTexture } from '../render/Glow';
import { GLSL_HASH, GLSL_VNOISE } from '../render/glsl';
import { PALETTE } from '../render/palette';
import type { HostileShot } from '../combat/CombatSystem';
import type { Landmark } from './Landmarks';

const STREAM_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv; varying vec3 vWorld; varying vec3 vView;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  // A slow ripple running downstream.
  w.y += sin(w.z * 0.9 - uTime * 2.2 + w.x * 0.6) * 0.03 + sin(w.z * 2.3 - uTime * 3.1) * 0.015;
  vWorld = w.xyz;
  vView = cameraPosition - w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const STREAM_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uDeep; uniform vec3 uBright; uniform vec3 uFoam;
varying vec2 vUv; varying vec3 vWorld; varying vec3 vView;
// Sine-free hash (Hoskins): the sin() kind loses precision at world coordinates and draws stripes.
${GLSL_HASH}
${GLSL_VNOISE}
void main() {
  // Flow: swirling noise carried downstream at one speed (a speed that varied across the channel would shear the
  // pattern further every second, into streaks), domain-warped so it eddies.
  vec2 p = vec2(vWorld.x * 0.6, vWorld.z * 0.6 - uTime * 0.55);
  vec2 warp = vec2(vnoise(p * 0.8 + vec2(0.0, uTime * 0.1)), vnoise(p * 0.8 + vec2(5.2, -uTime * 0.12))) - 0.5;
  p += warp * 1.6;
  float n = vnoise(p) * 0.6 + vnoise(p * 2.3) * 0.28 + vnoise(p * 5.1) * 0.12;
  // Mostly murky toxic green; bright where the scum gathers, and pin-point glints.
  vec3 c = mix(uDeep, uBright, smoothstep(0.55, 0.95, n));
  c += uFoam * pow(vnoise(p * 9.0 + uTime * 0.7), 14.0) * 0.8;
  // Grazing light off the surface (fresnel) and foam where the water meets the banks.
  float fres = pow(1.0 - clamp(normalize(vView).y, 0.0, 1.0), 3.0);
  float edge = smoothstep(0.16, 0.0, vUv.x) + smoothstep(0.84, 1.0, vUv.x);
  float foam = smoothstep(0.45, 0.9, edge * (0.6 + vnoise(p * 4.0 + 3.1)));
  c = mix(c, uFoam, foam * 0.55) + uBright * fres * 0.25;
  float alpha = 0.86 * smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x);
  gl_FragColor = vec4(c, alpha);
}`;

/** How deep the toxic water stands over the ravine bed (it reaches the knees). */
const DEPTH = 0.75;
/** Wading in it: a burn every this many seconds, and the poison it leaves. */
const BURN_EVERY = 0.7;
const BURN = { atk: 45, poison: { dps: 26, seconds: 4 } };
/** The witches notice you this close to the bridge, and each throws an orb every few seconds. */
const NOTICE = 14;
const ORB: HostileShot = { speed: 12, color: PALETTE.witch, atk: 70, kind: 'bolt', size: 1.3, radius: 0.7, poison: { dps: 22, seconds: 5 } };

export interface StreamHooks {
  /** A shot at the hero from `from`. */
  shoot(from: Vector3, s: HostileShot): void;
  /** The water burns the hero. */
  hurt(atk: number, poison: { dps: number; seconds: number }): void;
}

export function witchStream(
  centreAt: (z: number) => number, zMin: number, zMax: number, bridgeZ: number, deckY: number, heightAt: (x: number, z: number) => number, hooks: StreamHooks,
): Landmark {
  const g = new Group();
  // --- the water: a ribbon down the ravine, its surface a knee's depth over the bed at every step ---
  const steps = Math.ceil((zMax - zMin) / 1.5);
  const half = 4.2;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const surface: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const z = zMin + ((zMax - zMin) * i) / steps;
    const cx = centreAt(z);
    const y = heightAt(cx, z) + DEPTH;
    surface.push(y);
    pos.push(cx - half, y, z, cx + half, y, z);
    uv.push(0, i / steps, 1, i / steps);
    if (i < steps) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const waterMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDeep: { value: new Color(0x06260c) }, uBright: { value: new Color(PALETTE.witch).multiplyScalar(0.7) }, uFoam: { value: new Color(0xd9ffcf) } },
    vertexShader: STREAM_VERT, fragmentShader: STREAM_FRAG, transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true,
  });
  const water = new Mesh(geo, waterMat);
  water.frustumCulled = false;
  g.add(water);
  const levelAt = (z: number) => surface[Math.max(0, Math.min(steps, Math.round(((z - zMin) / (zMax - zMin)) * steps)))];
  // A low, faint toxic haze along the water (no columns of light).
  for (let z = zMin + 8; z < zMax; z += 16) {
    const haze = glowSprite(PALETTE.witch, 5, 0.1, true);
    haze.position.set(centreAt(z), levelAt(z) + 0.4, z);
    g.add(haze);
  }
  const light = new PointLight(PALETTE.witch, 22, 20, 1.8);
  light.position.set(centreAt(bridgeZ), levelAt(bridgeZ) + 2.5, bridgeZ);
  g.add(light);
  // Green fire over the cauldron.
  const fire = glowSprite(PALETTE.witch, 5, 0.6, true);
  fire.position.set(centreAt(bridgeZ), deckY + 2.2, bridgeZ);
  const fireLight = new PointLight(PALETTE.witch, 30, 14, 2);
  fireLight.position.copy(fire.position).y += 0.3;
  g.add(fire, fireLight);
  // Bubbles: some over the cauldron, most rising out of the stream and popping at the surface.
  const N = 140;
  const seeds: Array<{ z: number; off: number; rate: number; ph: number }> = [];
  for (let i = 0; i < N; i++) seeds.push({ z: zMin + Math.random() * (zMax - zMin), off: (Math.random() - 0.5) * 2 * (half - 0.8), rate: 0.4 + Math.random() * 0.6, ph: Math.random() * 10 });
  const bubbleGeo = new BufferGeometry();
  bubbleGeo.setAttribute('position', new Float32BufferAttribute(new Array(N * 3).fill(0), 3));
  const bubbleAttr = bubbleGeo.attributes.position as BufferAttribute;
  const bubbles = new Points(bubbleGeo, new PointsMaterial({ map: glowTexture(), color: PALETTE.witch, size: 0.28, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false }));
  bubbles.frustumCulled = false;
  g.add(bubbles);
  // Bubbles around a hero wading in it.
  const M = 24;
  const heroGeo = new BufferGeometry();
  heroGeo.setAttribute('position', new Float32BufferAttribute(new Array(M * 3).fill(0), 3));
  const heroAttr = heroGeo.attributes.position as BufferAttribute;
  const heroBubbles = new Points(heroGeo, new PointsMaterial({ map: glowTexture(), color: 0x9dff7a, size: 0.22, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }));
  heroBubbles.frustumCulled = false;
  heroBubbles.visible = false;
  g.add(heroBubbles);

  const witches = [0, 1, 2].map(() => { const r = new Rig(WITCH); g.add(r.root); return { r, wait: 1 + Math.random() * 2, cast: -1 }; });
  let t = 0;
  let burn = 0;
  let wading = 0;
  const muzzle = new Vector3();
  return {
    object: g,
    footprints: [],
    update(dt, player) {
      t += dt;
      waterMat.uniforms.uTime.value = t;
      // Far away (the stream runs 90 m along z around its bridge): the bubbles, witches and lights can rest.
      if (Math.hypot(player.x - centreAt(bridgeZ), player.z - bridgeZ) > 110) return;
      fire.scale.setScalar(5 + Math.sin(t * 7) * 0.5 + Math.sin(t * 13) * 0.3);
      fireLight.intensity = 26 + Math.sin(t * 9) * 6;
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        const k = ((t * s.rate + s.ph) % 1.4) / 1.4;
        const z = i < 30 ? bridgeZ : s.z;
        if (i < 30) {
          // Over the cauldron.
          const a = s.ph + k * 3;
          bubbleAttr.setXYZ(i, centreAt(bridgeZ) + Math.cos(a) * 0.4 * (1 + k), deckY + 1.4 + k * 2.2, bridgeZ + Math.sin(a) * 0.4 * (1 + k));
        } else bubbleAttr.setXYZ(i, centreAt(z) + s.off + Math.sin(k * 6 + s.ph) * 0.05, levelAt(z) - 0.25 + k * 0.4, z + k * 0.6);
      }
      bubbleAttr.needsUpdate = true;
      // In the water: it burns, poisons, and fizzes around you.
      const inStream = player.z > zMin && player.z < zMax && Math.abs(player.x - centreAt(player.z)) < half - 0.4 && player.y < levelAt(player.z) + 0.1;
      wading = inStream ? Math.min(1, wading + dt * 4) : Math.max(0, wading - dt * 2);
      heroBubbles.visible = wading > 0.01;
      if (heroBubbles.visible) {
        for (let i = 0; i < M; i++) {
          const k = ((t * (0.8 + (i % 5) * 0.15) + i * 0.37) % 1);
          const a = i * 2.4 + t * 0.6;
          const r = 0.35 + k * 0.5;
          heroAttr.setXYZ(i, player.x + Math.cos(a) * r, levelAt(player.z) - 0.1 + k * (0.6 + wading), player.z + Math.sin(a) * r);
        }
        heroAttr.needsUpdate = true;
        (heroBubbles.material as PointsMaterial).opacity = 0.9 * wading;
      }
      burn -= dt;
      if (inStream && burn <= 0) { burn = BURN_EVERY; hooks.hurt(BURN.atk, BURN.poison); }
      // The coven: circling the cauldron; near the bridge, each in turn raises her staff and throws an orb.
      const near = Math.hypot(player.x - centreAt(bridgeZ), player.z - bridgeZ) < NOTICE;
      for (let i = 0; i < witches.length; i++) {
        const w = witches[i];
        const a = t * 0.55 + (i / 3) * Math.PI * 2;
        const rad = 2.6 + Math.sin(t * 1.3 + i) * 0.3;
        const r = w.r;
        r.root.position.set(centreAt(bridgeZ) + Math.cos(a) * rad, deckY + 0.45 + Math.abs(Math.sin(t * 2.2 + i * 2)) * 0.12, bridgeZ + Math.sin(a) * rad * 0.7);
        let yaw = Math.atan2(Math.cos(a) * 0.7, -Math.sin(a));
        let attack: number | undefined;
        if (w.cast >= 0) {
          // Facing the hero for the cast; the orb leaves the staff at the top of the swing.
          w.cast += dt / 0.7;
          yaw = Math.atan2(player.z - r.root.position.z, player.x - r.root.position.x);
          attack = Math.min(1, w.cast);
          if (w.cast >= 0.55 && w.cast - dt / 0.7 < 0.55) {
            const from = r.muzzle(muzzle) ?? muzzle.set(r.root.position.x, r.root.position.y + 1.8, r.root.position.z);
            hooks.shoot(from, ORB);
          }
          if (w.cast >= 1) w.cast = -1;
        } else if (near) {
          w.wait -= dt;
          if (w.wait <= 0) { w.cast = 0; w.wait = 2.2 + Math.random() * 1.6; }
        }
        r.root.rotation.y = yawToRotation(yaw);
        r.animate({ mode: 'ground', speed: w.cast >= 0 ? 0 : 1.6 + Math.sin(t * 1.1 + i) * 0.4, attack, attackKind: 'skill' }, dt);
      }
    },
  };
}
