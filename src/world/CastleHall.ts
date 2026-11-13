/**
 * The Moon Throne Hall inside the island castle (LAYOUT.castle): press F at the gate (the playtest of 2026-11-12: "make
 * it so I can press F and enter the castle, think of something cool to put there"). A pillared vault (galaxy-hall.glb
 * from Dd0wR9Jh2lH, re-coloured the island's cobalt) with a river of light down its aisle to an empty marble throne;
 * over the throne the island's moon hangs captive, grinning, the lost crown turning beneath it; blue flames burn
 * between the pillars. Sit on the throne and the hall takes you for its king: the moon flares, the flames leap and the
 * party is healed (main.ts, reward 'throne').
 *
 * galaxy-hall.glb at 15 m, measured from its mesh: 27 × 27 m, its floor 0.1–0.3 m up, the vault from about 11 m; a
 * clear aisle 8 m wide down the middle; pillars in four rows either side, at x ±7.5 and ±11.5 from its middle and
 * z −11.5, −5, 4 and 10.5, each about 2.4 m through.
 */
import { Color, Group, type Mesh, type MeshStandardMaterial, PointLight, Vector3 } from 'three';
import { CASTLE_HALL, LAYOUT, SINK } from '../data/world';
import { MODELS } from '../data/models';
import { darkHollow } from '../render/Floors';
import { glowSprite } from '../render/Glow';
import { patchRetint } from '../render/Materials';
import { faceMoon } from '../render/MoonFace';
import type { ModelRig } from '../models/ModelRig';
import type { Footprint } from './Colliders';
import { fire } from './Fire';
import type { Interactable, Teleport } from './Interact';
import { modelLandmark } from './ModelLandmark';
import type { RealmApi } from './Realms';
import { waterRibbon } from './Water';

/** The foot of the castle's front stairs, on the island ground before its south face (castle.glb is 31 m deep). */
export const CASTLE_GATE = { x: LAYOUT.castle.x, z: LAYOUT.castle.z + 15.2 } as const;
/**
 * The landing at the top of those stairs, before the door, where you press F (measured on the model's collider: the
 * stairs climb 6.56 m from the castle's base to a landing at z + 10, the door's face at z + 9.6).
 */
export const CASTLE_DOOR = { x: LAYOUT.castle.x, z: LAYOUT.castle.z + 10, rise: 6.56 } as const;
/** Blue flames for the island's castle (cobalt, not the Lean Quarter's purple). */
const BLUE_FIRE = { core: 0x3a7bff, inner: 0xd6e6ff, ember: 0x1a3cff };
const face = (yaw: number) => Math.PI / 2 - yaw;
const PILLAR_X = [-11.5, -7.5, 7.5, 11.5];
const PILLAR_Z = [-11.5, -5, 4, 10.5];

function restyle(model: ModelRig, fn: (mat: MeshStandardMaterial) => void): void {
  model.root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    fn(mat);
    m.material = mat;
  });
}

export function buildCastleHall(api: RealmApi, teleport: Teleport, reward: (what: string) => void, groundAt: (x: number, z: number) => number): Interactable[] {
  const R = CASTLE_HALL;
  const x = R.x, z = R.z, y = R.y;
  api.realm(R.id);
  const glow = (color: number, size: number, gx: number, gy: number, gz: number, opacity = 0.5) => {
    const s = glowSprite(color, size, opacity, true);
    s.position.set(gx, gy, gz);
    api.group.add(s);
    return s;
  };
  api.group.add(darkHollow(x, y, z, 40, R.fog.color));
  // The hall (its roof would be its floor in a baked grid: hand-made colliders below).
  api.place(modelLandmark('galaxy-hall', x, z, y, { collider: 'none', onLoad: (m) => restyle(m, (mat) => { patchRetint(mat, new Color(0.42, 0.52, 1.05)); mat.roughness = Math.max(0.85, mat.roughness); mat.metalness = 0; }) }));
  const floor = y + 0.15;
  const solid: Footprint[] = [
    { kind: 'box', x, z, hw: 13.6, hd: 13.6, top: y },
    { kind: 'box', x: x - 13.9, z, hw: 0.4, hd: 14.2, top: y + 80 }, { kind: 'box', x: x + 13.9, z, hw: 0.4, hd: 14.2, top: y + 80 },
    { kind: 'box', x, z: z - 13.9, hw: 14.2, hd: 0.4, top: y + 80 }, { kind: 'box', x, z: z + 13.9, hw: 14.2, hd: 0.4, top: y + 80 },
    { kind: 'box', x, z, hw: 14.2, hd: 14.2, top: y + 80, bottom: y + 11 },
  ];
  for (const px of PILLAR_X) for (const pz of PILLAR_Z) solid.push({ kind: 'cyl', x: x + px, z: z + pz, r: 1.2, top: y + 11 });

  // The river of light down the aisle, from the door to the throne's step.
  const river: Array<[number, number, number]> = [];
  for (let k = 12; k >= -8; k -= 2) river.push([x, z + k, floor - 0.05]);
  api.place(waterRibbon(river, 1.1, [0x0a1a6a, 0x4a8cff, 0xe0ecff], 1.2));

  // The empty marble throne at the far end, on a step, facing the door.
  const T = { x, z: z - 10.4 };
  api.place(modelLandmark('marble-throne', T.x, T.z, floor + 0.3, { yaw: face(Math.PI / 2), collider: 'manual', footprints: [{ kind: 'box', x: T.x, z: T.z - 0.2, hw: 1.0, hd: 0.8, top: floor + 0.8 }] }));
  solid.push({ kind: 'box', x: T.x, z: T.z, hw: 2.6, hd: 1.8, top: floor + 0.3 });
  api.place({ object: new Group(), footprints: solid });

  // Over it, the island's moon held captive (moon-grin), and under it the lost crown, turning.
  const moon = faceMoon('moon-grin', 3.2, { glow: 0.85, crescent: 0.15, light: new Vector3(0, 0.3, 1) });
  moon.group.position.set(T.x, y + 7.6, T.z - 1.6);
  api.group.add(moon.group);
  const moonLight = new PointLight(0x9fb8ff, 30, 34, 1.4);
  moonLight.position.set(T.x, y + 6.5, T.z + 2);
  api.group.add(moonLight);
  const halo = glow(0x8fb0ff, 9, T.x, y + 7.6, T.z - 1.8, 0.35);
  const crownAt = { x: T.x, y: y + 4.6, z: T.z + 0.2 };
  let crownRoot: Group | null = null;
  api.place(modelLandmark('giant-crown', crownAt.x, crownAt.z, crownAt.y, { collider: 'none', scale: 1.1 / MODELS['giant-crown'].height, update: (_dt, root) => { crownRoot = root; } }));
  glow(0xffc23a, 1.6, crownAt.x, crownAt.y + 0.5, crownAt.z, 0.4);

  // Blue flames in braziers along the aisle, between the inner pillars, and two chandeliers of candles.
  const flames: Array<{ group: Group; update: (dt: number) => void }> = [];
  for (const side of [-1, 1]) for (const pz of [-8.2, -0.5, 7.2]) {
    const bx = x + side * 5.2, bz = z + pz;
    api.place(modelLandmark('brazier', bx, bz, floor, { footprints: [{ kind: 'cyl', x: bx, z: bz, r: 0.55, top: floor + 1.2 }], collider: 'manual' }));
    const f = fire(bx, floor + 1.35, bz, 0.5, 8, BLUE_FIRE);
    flames.push(f);
    api.vfx(f);
  }
  for (const cz of [-2.5, 5.5]) {
    api.place(modelLandmark('chandelier', x, z + cz, y + 6.8, { collider: 'none' }));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; glow(0xffb050, 0.7, x + Math.cos(a) * 0.75, y + 7.35, z + cz + Math.sin(a) * 0.75, 0.55); }
  }

  // The door out, at the near end.
  const exitZ = z + 12.6;
  api.place(modelLandmark('treehouse-door', x, exitZ + 0.6, floor, { yaw: face(-Math.PI / 2), collider: 'none', scale: 3 / MODELS['treehouse-door'].height }));
  glow(0x9fb4ff, 2.4, x, floor + 3.2, exitZ + 0.4, 0.3);

  // The throne's blessing: once a minute.
  let rest = 0;
  let flare = 0;
  api.vfx({ group: new Group(), update: (dt) => {
    rest = Math.max(0, rest - dt);
    flare = Math.max(0, flare - dt);
    const k = flare > 0 ? Math.sin((flare / 3) * Math.PI) : 0;
    moon.group.scale.setScalar(1 + 0.18 * k);
    moonLight.intensity = 30 + 60 * k;
    halo.scale.setScalar(9 * (1 + k));
    for (const f of flames) f.group.scale.setScalar(1 + 0.8 * k);
    if (crownRoot) crownRoot.rotation.y += dt * (0.25 + 2 * k);
    moon.update(dt);
  } });
  api.realm(null);

  // The front stairs: treads from the ground to the door's landing under the model's own steps (one of its risers is
  // 0.66 m, more than a step, so nobody could walk up), and the door's prompt on the landing.
  const doorY = groundAt(LAYOUT.castle.x, LAYOUT.castle.z) - SINK.castle + CASTLE_DOOR.rise;
  const footY = groundAt(CASTLE_GATE.x, CASTLE_GATE.z);
  const treads: Footprint[] = [];
  const run = CASTLE_GATE.z - CASTLE_DOOR.z;
  const n = Math.max(1, Math.ceil((doorY - footY) / 0.33));
  for (let i = 1; i <= n; i++) {
    const top = footY + ((doorY - footY) * i) / n;
    const zc = CASTLE_GATE.z - (run * (i - 0.5)) / n;
    treads.push({ kind: 'box', x: CASTLE_DOOR.x, z: zc, hw: 1.6, hd: run / n / 2 + 0.02, top, bottom: top - 1.2 });
  }
  api.place({ object: new Group(), footprints: treads });
  return [
    { pos: new Vector3(CASTLE_DOOR.x, doorY, CASTLE_DOOR.z), range: 2.8, zone: null, label: () => 'Enter the castle', act: () => teleport(x, floor, exitZ - 2, -Math.PI / 2, R.name) },
    { pos: new Vector3(x, floor, exitZ - 0.4), range: 1.6, zone: R.id, label: () => 'Leave the castle', act: () => teleport(CASTLE_DOOR.x, doorY, CASTLE_DOOR.z + run / n / 2, Math.PI / 2) },
    {
      pos: new Vector3(T.x, floor, T.z + 1.6), range: 2.4, zone: R.id,
      label: () => (rest > 0 ? null : 'Sit on the empty throne'),
      act: () => { if (rest > 0) return; rest = 60; flare = 3; reward('throne'); },
    },
  ];
}
