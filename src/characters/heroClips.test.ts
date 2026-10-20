import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, BoxGeometry, Group, LoopOnce, Mesh, MeshStandardMaterial, Object3D, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MODELS, type ClipName } from '../data/models';
import { ModelRig } from '../models/ModelRig';
import { HERO_CLIPS, SOURCE_SECONDS, comboTiming, cutSeconds, heavyTiming, skillTiming, type ClipCut, type HeroClips, type HeroId } from './heroClips';

const heroes = Object.keys(HERO_CLIPS) as HeroId[];

/** Every cut of a hero, named. */
function cutsOf(h: HeroClips): Array<[string, ClipCut]> {
  const out: Array<[string, ClipCut]> = [
    ['attack0', h.attack[0]], ['attack1', h.attack[1]], ['attack2', h.attack[2]], ['heavy', h.heavy], ['skill', h.skill],
    ['hit', h.hit], ['dodge', h.dodge], ['death', h.death], ['jump.land', h.jump.land],
    ['jump.takeoff', { key: h.jump.key, from: h.jump.takeoff[0], to: h.jump.takeoff[1] }],
  ];
  if (h.charge) out.push(['charge', h.charge]);
  if (h.burst) out.push(['burst', h.burst]);
  return out;
}

const knows = (hero: HeroId, key: ClipName): boolean => key in (MODELS[hero].clips ?? {}) || key in (MODELS[hero].clipFiles ?? {});

describe('HERO_CLIPS', () => {
  it('every cut lies inside its source clip, in order', () => {
    for (const hero of heroes) for (const [name, c] of cutsOf(HERO_CLIPS[hero])) {
      const src = SOURCE_SECONDS[hero][c.key];
      expect(src, `${hero} ${name}: ${c.key} has no measured duration`).toBeDefined();
      const from = c.from ?? 0;
      const to = c.to ?? src!;
      expect(from, `${hero} ${name} from`).toBeGreaterThanOrEqual(0);
      expect(to, `${hero} ${name} to > from`).toBeGreaterThan(from);
      expect(to, `${hero} ${name} to ≤ ${c.key} (${src} s)`).toBeLessThanOrEqual(src! + 1e-6);
      if (c.speed !== undefined) expect(c.speed).toBeGreaterThan(0);
      if (c.fade !== undefined) expect(c.fade).toBeGreaterThanOrEqual(0);
    }
  });

  it('every move that deals damage has a strike in (0, 1]', () => {
    for (const hero of heroes) {
      const h = HERO_CLIPS[hero];
      for (const [name, c] of [...h.attack.map((a, i) => [`attack${i}`, a] as const), ['heavy', h.heavy] as const, ['skill', h.skill] as const]) {
        expect(c.strike, `${hero} ${name} strike`).toBeDefined();
        expect(c.strike!, `${hero} ${name} strike > 0`).toBeGreaterThan(0);
        expect(c.strike!, `${hero} ${name} strike ≤ 1`).toBeLessThanOrEqual(1);
      }
      expect(h.heavyHold).toBeGreaterThanOrEqual(0);
      expect(h.heavyHold).toBeLessThan(1);
      expect(h.jump.apex).toBeGreaterThan(0);
      expect(h.jump.apex).toBeLessThanOrEqual(1);
      expect(h.jump.takeoff[1]).toBeLessThanOrEqual(h.jump.land.from ?? 0);
    }
  });

  it('refers to clip keys the registry knows (clips or the hero-climb map)', () => {
    for (const hero of heroes) {
      const h = HERO_CLIPS[hero];
      for (const [name, c] of cutsOf(h)) expect(knows(hero, c.key), `${hero} ${name}: ${c.key}`).toBe(true);
      expect(knows(hero, h.walk)).toBe(true);
      expect(knows(hero, h.run)).toBe(true);
      expect(knows(hero, h.jump.key)).toBe(true);
    }
  });

  it('mirrored cuts refer to existing keys', () => {
    for (const hero of heroes) for (const [name, c] of cutsOf(HERO_CLIPS[hero])) if (c.mirror) expect(knows(hero, c.key), `${hero} ${name}`).toBe(true);
  });

  it('turns the cuts into the game timings', () => {
    const k = HERO_CLIPS.knight;
    expect(cutSeconds('knight', k.attack[0])).toBeCloseTo(0.75 / 1.25, 5);
    expect(comboTiming('knight').durations).toHaveLength(3);
    expect(comboTiming('knight').strikes).toEqual(k.attack.map((a) => a.strike));
    // Sir Aldric holds his own wind-up: the swing resumes from it. Wren holds an aim clip: her shot starts fresh.
    expect(heavyTiming('knight').startAt).toBe(k.heavyHold);
    expect(heavyTiming('archer').startAt).toBe(0);
    expect(heavyTiming('knight').strike).toBe(k.heavy.strike);
    expect(skillTiming('archer').duration).toBeCloseTo(cutSeconds('archer', HERO_CLIPS.archer.skill), 6);
    // A body without a table gets the generic timings.
    expect(comboTiming('witch').durations).toHaveLength(3);
    expect(heavyTiming('witch').startAt).toBe(0);
    expect(skillTiming('witch').strike).toBeGreaterThan(0);
  });
});

/** A stand-in for knight.glb: the Mixamo bone names the registry's hero entries expect, and clips named like Meshy's. */
function fakeKnight(): ModelRig {
  const scene = new Group();
  const bone = (name: string, parent: Object3D, x: number, y: number, z = 0): Bone => {
    const b = new Bone();
    b.name = `mixamorig${name}`;
    b.position.set(x, y, z);
    parent.add(b);
    return b;
  };
  const hips = bone('Hips', scene, 0, 1.0);
  const spine = bone('Spine', hips, 0, 0.1);
  const spine1 = bone('Spine1', spine, 0, 0.15);
  const spine2 = bone('Spine2', spine1, 0, 0.15);
  const neck = bone('Neck', spine2, 0, 0.15);
  bone('Head', neck, 0, 0.1);
  for (const side of ['Left', 'Right']) {
    const s = side === 'Left' ? 1 : -1;
    const shoulder = bone(`${side}Shoulder`, spine2, s * 0.08, 0.1);
    const arm = bone(`${side}Arm`, shoulder, s * 0.12, 0);
    const fore = bone(`${side}ForeArm`, arm, s * 0.28, 0);
    bone(`${side}Hand`, fore, s * 0.26, 0);
    const up = bone(`${side}UpLeg`, hips, s * 0.1, -0.05);
    const leg = bone(`${side}Leg`, up, 0, -0.45);
    bone(`${side}Foot`, leg, 0, -0.45);
  }
  const body = new Mesh(new BoxGeometry(0.5, 1.95, 0.3), new MeshStandardMaterial());
  body.position.y = 0.975;
  scene.add(body);
  const q = new Quaternion();
  const axis = new Vector3(0, 0, 1);
  /** A rotation track keyed every 1/30 s (or only at the ends when `sparse`): a sine swing about z. */
  const turn = (name: string, seconds: number, amp: number, sparse = false): QuaternionKeyframeTrack => {
    const times: number[] = [];
    const values: number[] = [];
    const n = Math.round(seconds * 30);
    for (let i = 0; i <= n; i++) {
      if (sparse && i !== 0 && i !== n) continue;
      const t = (seconds * i) / n;
      times.push(t);
      q.setFromAxisAngle(axis, Math.sin((t / seconds) * Math.PI * 2) * amp);
      values.push(q.x, q.y, q.z, q.w);
    }
    return new QuaternionKeyframeTrack(`mixamorig${name}.quaternion`, times, values);
  };
  /** The hips' height over the clip, from `y(t)` in metres (rest 1). */
  const hipsY = (seconds: number, y: (t: number) => number): VectorKeyframeTrack => {
    const times: number[] = [];
    const values: number[] = [];
    const n = Math.round(seconds * 30);
    for (let i = 0; i <= n; i++) { const t = (seconds * i) / n; times.push(t); values.push(0.01 * Math.sin(t), y(t), 0); }
    return new VectorKeyframeTrack('mixamorigHips.position', times, values);
  };
  const simple = (name: string, seconds: number) => new AnimationClip(name, seconds, [turn('RightArm', seconds, 0.8), turn('LeftArm', seconds, 0.4), turn('Spine', seconds, 0.2), hipsY(seconds, () => 1)]);
  const animations = [
    simple('Idle_02', 1.875), simple('Walking', 1.042), simple('Running', 0.667),
    // The slash: the sword arm keyed every frame, the off-arm only at the ends (a window cut from the middle must still key it).
    new AnimationClip('Right_Hand_Sword_Slash', 1.5, [turn('RightArm', 1.5, 1.2), turn('RightForeArm', 1.5, 0.6), turn('LeftArm', 1.5, 0.3, true), turn('Spine', 1.5, 0.3), hipsY(1.5, () => 1)]),
    simple('Sword_Judgment', 4.333), simple('Sword_Shout', 6.208), simple('Hit_Reaction', 1.667), simple('Stand_Dodge', 1.417),
    simple('dying_backwards', 2.208), simple('Stand_and_Drink', 8.875), simple('Swim_Forward', 4.5), simple('Swim_Idle', 3),
    // The jump: a leap above the rest from 1.5 to 2.3, a crouch below it from 2.3 to 2.6.
    new AnimationClip('Basic_Jump', 5.875, [turn('RightArm', 5.875, 0.5), turn('LeftUpLeg', 5.875, 0.5), hipsY(5.875, (t) => (t > 1.5 && t < 2.3 ? 1 + 0.6 * Math.sin(((t - 1.5) / 0.8) * Math.PI) : t >= 2.3 && t < 2.6 ? 0.8 : 1))]),
  ];
  return new ModelRig('knight', { scene, animations } as unknown as GLTF);
}

describe('ModelRig cuts (a stand-in skeleton with the knight clip names)', () => {
  const rig = fakeKnight();
  const K = HERO_CLIPS.knight;

  it('cuts a window out of a clip, keys every bone of the source and knows its strike', () => {
    const a = rig.cut('hero:attack0', K.attack[0]);
    expect(a).not.toBeNull();
    const clip = a!.getClip();
    expect(clip.duration).toBeCloseTo(0.75, 1);
    const names = clip.tracks.map((t) => t.name);
    expect(names).toContain('mixamorigRightArm.quaternion');
    // The off-arm had keys only at the clip's ends: the cut gives it one, posed at the window's start.
    const left = clip.tracks.find((t) => t.name === 'mixamorigLeftArm.quaternion');
    expect(left).toBeDefined();
    expect(left!.times.length).toBe(1);
    // The clip's travel on the ground is the controller's: the hips stay where the clip starts (x/z), y keeps its dips.
    const hips = clip.tracks.find((t) => t.name === 'mixamorigHips.position')!;
    for (let i = 0; i < hips.values.length; i += 3) { expect(hips.values[i]).toBe(0); expect(hips.values[i + 2]).toBe(0); }
    const fall = rig.cut('hero:death', { ...K.death });
    const fallHips = fall!.getClip().tracks.find((t) => t.name === 'mixamorigHips.position')!;
    expect(Array.from(fallHips.values).some((x, i) => i % 3 === 0 && x !== 0)).toBe(true); // a death keeps its fall (keepRoot)
    expect(rig.strikeOf('hero:attack0')).toBe(K.attack[0].strike);
    expect(rig.strikeOf('attack')).toBeCloseTo(0.38, 5); // STRIKE_AT for a slash, the mobs' rule
    expect(rig.cut('hero:attack0', K.attack[0])).toBe(a); // cached by id
    expect(rig.cut('hero:none', { key: 'throw' })).toBeNull();
  });

  it('registers a mirror of the source as <clip>#m and cuts from it', () => {
    const a = rig.cut('hero:mirror', { key: 'attack', from: 0.2, to: 0.95, mirror: true });
    expect(a).not.toBeNull();
    expect(rig.has('right_hand_sword_slash#m')).toBe(true);
    expect(rig.clipName('right_hand_sword_slash#m')).toBe('right_hand_sword_slash');
    expect(a!.getClip().duration).toBeCloseTo(0.75, 1);
    expect(a!.getClip().tracks.some((t) => /LeftArm\.quaternion$/.test(t.name))).toBe(true);
  });

  it('fits a one-shot within 0.5–2.5× and restarts it on a twin action instead of popping', () => {
    rig.cut('hero:attack1', K.attack[1]);
    rig.play('hero:attack0', { once: true, fitTo: 0.1 });
    expect(rig.action!.timeScale).toBe(2.5);
    rig.play('hero:attack1', { once: true, fitTo: 100 });
    expect(rig.action!.timeScale).toBe(0.5);
    rig.play('hero:attack1', { once: true, fitTo: 0.53, restart: true, at: 0.1 });
    const first = rig.action!;
    expect(first.time).toBeCloseTo(first.getClip().duration * 0.1, 5);
    rig.update(0.1);
    rig.play('hero:attack1', { once: true, fitTo: 0.53, restart: true });
    const second = rig.action!;
    expect(second).not.toBe(first);
    expect(second.getClip()).toBe(first.getClip());
    expect(first.isRunning()).toBe(true); // fading out under the new swing
    expect(second.isRunning()).toBe(true);
    expect(rig.playing).toBe('hero:attack1');
    // The positional form still works for every other caller, with its old fit range (Enemy's hit flinch: 2.56×).
    expect(rig.play('hit', true, 1, 0.65)).toBe(true);
    expect(rig.action!.timeScale).toBeCloseTo(1.667 / 0.65, 2);
    expect(rig.play('walk', false, 1.3)).toBe(true);
    expect(rig.action!.timeScale).toBe(1.3);
  });

  it('keeps the hips of a jump landing at or below their rest', () => {
    const a = rig.cut('hero:land', K.jump.land);
    expect(a).not.toBeNull();
    const hips = a!.getClip().tracks.find((t) => /Hips\.position$/.test(t.name));
    expect(hips).toBeDefined();
    const v = hips!.values;
    let lowest = Infinity;
    for (let i = 0; i < v.length; i += 3) { expect(v[i + 1]).toBeLessThanOrEqual(1 + 1e-6); lowest = Math.min(lowest, v[i + 1]); expect(v[i]).toBe(0); }
    expect(lowest).toBeLessThan(1); // the crouch stays
    const up = rig.cut('hero:jumpUp', { key: K.jump.key, from: K.jump.takeoff[0], to: K.jump.takeoff[1], groundHips: true });
    const upHips = up!.getClip().tracks.find((t) => /Hips\.position$/.test(t.name))!;
    for (let i = 1; i < upHips.values.length; i += 3) expect(upHips.values[i]).toBeLessThanOrEqual(1 + 1e-6); // the leap is the controller's
  });

  it('the positional form keeps its old fit range: a 6.2 s stand-up fits a 1.4 s rise at 4.4×', () => {
    // Enemy.ts plays Sit_to_Stand_Transition_M (6.208 s on the skeletons) with play('stand', true, 1, STAND_UP = 1.4):
    // Sword_Shout (6.208 s) stands in for it here. The heroes' cuts, asked through the options form, stay within 0.5–2.5×.
    expect(rig.play('cast', true, 1, 1.4)).toBe(true);
    expect(rig.action!.timeScale).toBeCloseTo(6.208 / 1.4, 2);
    expect(rig.play('hit', true, 1, 100)).toBe(true);
    expect(rig.action!.timeScale).toBeCloseTo(0.3, 5); // the old floor
    rig.play('cast', { once: true, fitTo: 1.4 });
    expect(rig.action!.timeScale).toBe(2.5);
    rig.play('heavy', { once: true, fitTo: 1.4, rate: [0.3, Infinity] });
    expect(rig.action!.timeScale).toBeCloseTo(4.333 / 1.4, 2);
  });

  it('a held wind-up let go early catches up to its blow, then plays on at the cut\'s pace', () => {
    const cutDur = rig.cut('hero:heavy', K.heavy)!.getClip().duration; // 1.5 s of Sword_Judgment
    const strike = K.heavy.strike!;
    const speed = K.heavy.speed!;
    // The game's time from the held frame to the blow (CombatSystem starts the swing at heavyHold).
    const seconds = (strike - K.heavyHold) * cutSeconds('knight', K.heavy);
    // A tap: one frame in, the hold frame (heavyHold 0.24 of the cut) was never reached.
    rig.play('hero:heavy', { once: true, speed });
    rig.update(0.02);
    const a = rig.action!;
    expect(a.time).toBeLessThan(cutDur * K.heavyHold);
    rig.resumeStrike(strike, seconds, speed);
    expect(a.timeScale).toBeCloseTo((cutDur * strike - a.time) / seconds, 3);
    expect(a.timeScale).toBeGreaterThan(speed); // catching up
    let steps = 0;
    while (a.time < cutDur * strike && steps < 200) { rig.update(0.01); steps++; }
    expect(steps * 0.01).toBeCloseTo(seconds, 1); // the blow came when the game's did
    expect(a.timeScale).toBeCloseTo(speed, 5); // and the follow-through runs at the cut's own pace
    // Held at the frame (the usual charge): from there the blow is a plain 1.3× away.
    rig.play('hero:heavy', { once: true, speed, restart: true });
    const b = rig.action!;
    expect(b).not.toBe(a);
    for (let i = 0; i < 40; i++) { rig.update(0.01); rig.holdAt(K.heavyHold); }
    expect(b.paused).toBe(true);
    rig.resumeStrike(strike, seconds, speed);
    expect(b.paused).toBe(false);
    expect(b.timeScale).toBeCloseTo(speed, 1);
    // Switching clips forgets the fit.
    rig.play('idle');
    rig.update(0.5);
    expect(b.timeScale).toBeCloseTo((cutDur * strike - cutDur * K.heavyHold) / seconds, 1); // untouched by the handover
  });

  it('a flinch layer holds only the asked bones and plays once', () => {
    rig.cut('hero:flinch', { key: 'hit', from: 0, to: 0.55 });
    const a = rig.layerOnce('hero:flinch', /spine|neck|head|arm/i, 30, 0.35);
    expect(a).not.toBeNull();
    for (const t of a!.getClip().tracks) expect(t.name).toMatch(/spine|neck|head|arm/i);
    expect(a!.getClip().tracks.some((t) => /Hips/.test(t.name))).toBe(false);
    expect(a!.loop).toBe(LoopOnce);
    expect(a!.isRunning()).toBe(true);
    expect(a!.getEffectiveWeight()).toBe(30);
    expect(a!.timeScale).toBeCloseTo(0.55 / 0.35, 1);
    rig.update(0.5);
    expect(a!.isRunning()).toBe(false); // switched itself off at its end
  });
});
