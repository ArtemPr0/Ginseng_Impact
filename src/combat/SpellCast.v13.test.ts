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

describe('the black hole goes where it is put, and eats (playtest 2026-11-17)', () => {
  const coreY = (scene: Group) => { let y = -Infinity; scene.traverse((o) => { if (o.name === 'core') y = o.getWorldPosition(new Vector3()).y; }); return y; };
  it('opens at the lift it was aimed with: halfway into the ground', () => {
    const { host, scene } = fakeHost();
    const sc = new SpellCast(host);
    sc.holeLift = 0;
    sc.cast('wizard', 1, new Vector3(0, 2, 10));
    sc.update(0.1);
    scene.updateMatrixWorld(true);
    expect(Math.abs(coreY(scene) - 2)).toBeLessThan(0.6);
  });
  it('a mob dragged into its core is eaten: killed and gone; a boss is not', () => {
    const e = mob(2, 10);
    const boss = mob(-2, 10, { def: { height: 3, speed: 2, bodyRadius: 1, boss: true } });
    const big: Array<{ e: unknown; mult: number }> = [];
    const { host } = fakeHost({ enemies: [e as never, boss as never], hit: (x, mult) => { big.push({ e: x, mult }); if (mult >= 50) (x as { alive: boolean }).alive = false; } });
    const sc = new SpellCast(host);
    sc.holeLift = 0;
    sc.cast('wizard', 1, new Vector3(0, 0, 10));
    for (let i = 0; i < 50; i++) sc.update(0.1);
    expect(e.alive).toBe(false);
    expect(e.object.visible).toBe(false);
    expect(boss.alive).toBe(true);
  });
});

describe('the fire tornado runs toward the crosshair (its path is what the preview drew)', () => {
  it('heads for the aim, not just the way he faces', () => {
    const { host, scene } = fakeHost();
    const sc = new SpellCast(host);
    host.controller.yaw = 0; // facing +x
    sc.cast('wizard', 2, new Vector3(0, 0, 20)); // aimed down +z
    for (let i = 0; i < 30; i++) sc.update(0.1);
    let p = new Vector3();
    scene.traverse((o) => { if (o.name === 'fire-tornado') p = o.position.clone(); });
    expect(p.z).toBeGreaterThan(5);
    expect(Math.abs(p.x)).toBeLessThan(4);
  });
});
