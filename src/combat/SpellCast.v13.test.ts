import { describe, expect, it } from 'vitest';
import { Color, Group, Vector3 } from 'three';
import { SpellCast } from './SpellCast';
import { fakeHost } from './spellHost.fixture';
import { bloodSky } from './CombatSystem';

function mob(x: number, z: number, o: Record<string, unknown> = {}) {
  return {
    id: Math.random(), alive: true, pos: new Vector3(x, 0, z), def: { height: 1.8, speed: 3, bodyRadius: 0.4 }, held: false, thrown: null as unknown,
    object: new Group(), shove() {}, afflict() {}, leap() {}, ...o,
  };
}

describe('Moonbomb (playtest 2026-11-17: it blinded the screen)', () => {
  it('lands as a cold blue burst with a modest light, never near-white', () => {
    const flashes: number[] = [];
    const hots: number[] = [];
    const { host } = fakeHost({ lights: { flash: (_a, _c, i) => { flashes.push(i); }, hold: () => ({ pos: new Vector3(), intensity: 0, done: false }) } });
    const sc = new SpellCast(host);
    const burst = sc.explosions.burst.bind(sc.explosions);
    sc.explosions.burst = (at, r, o) => { hots.push(o?.hot ?? 0xffffff); return burst(at, r, o); };
    sc.cast('archer', 0, new Vector3(0, 0, 12));
    for (let i = 0; i < 12; i++) sc.update(0.1);
    expect(flashes.length).toBeGreaterThan(0);
    expect(Math.max(...flashes)).toBeLessThanOrEqual(20);
    expect(hots.length).toBeGreaterThan(0);
    for (const h of hots) {
      const c = new Color(h);
      expect(0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b).toBeLessThan(0.5);
    }
  });
  it('throws real ice shards that fly out and fall (the reel\'s ice burst)', () => {
    const { host, sim } = fakeHost();
    const sc = new SpellCast(host);
    sc.cast('archer', 0, new Vector3(0, 0, 12));
    for (let i = 0; i < 6; i++) sc.update(0.1);
    expect(sim.pieces.length).toBeGreaterThanOrEqual(12);
  });
});

describe('Chain Hook (playtest: "doesn\'t seem to do anything")', () => {
  it('catches a mob near the crosshair line, not only one standing on the aim point', () => {
    const e = mob(1.5, 14);
    let hits = 0;
    const { host } = fakeHost({ enemies: [e as never], hit: () => { hits++; } });
    const sc = new SpellCast(host);
    host.controller.yaw = Math.PI / 2;
    sc.cast('knight', 2, new Vector3(0, 0, 24));
    for (let i = 0; i < 6; i++) sc.update(0.1);
    expect(hits).toBe(1);
    expect(Math.hypot(e.pos.x, e.pos.z)).toBeLessThan(3);
  });
  it('a real chain flies out (a mesh in the scene), and a miss says so', () => {
    const tips: string[] = [];
    const { host, scene } = fakeHost({ tip: (t) => { tips.push(t); } });
    const sc = new SpellCast(host);
    sc.cast('knight', 2, new Vector3(0, 0, 20));
    sc.update(0.05);
    let chain = false;
    scene.traverse((o) => { if (o.name === 'chain' && o.visible) chain = true; });
    expect(chain).toBe(true);
    expect(tips.some((t) => /no target/i.test(t))).toBe(true);
  });
});

describe('Blood Moon (playtest: the sky was already red in every fight)', () => {
  it('the sky turns red for Blood Moon or a burst, not because mobs are aggro', () => {
    expect(bloodSky(true, false, 0)).toBe(false);
    expect(bloodSky(false, false, 3)).toBe(true);
    expect(bloodSky(false, true, 0)).toBe(true);
  });
});
