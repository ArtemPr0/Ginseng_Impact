import { describe, expect, it } from 'vitest';
import { Group, Mesh, Vector3 } from 'three';
import { HOLE_BURST, SpellCast, type SpellHost } from './SpellCast';
import { Color } from 'three';

import { fakeHost } from './spellHost.fixture';
export { fakeHost };

const runes = (scene: Group) => {
  const out: Mesh[] = [];
  scene.traverse((o) => { if (o.name === 'rune' && o.visible) out.push(o as Mesh); });
  return out;
};

describe('SpellCast rune circles (v12)', () => {
  it('every cast opens a circle at the hand; a fireball stacks circles over its target', () => {
    const { host, scene } = fakeHost();
    const sc = new SpellCast(host);
    sc.cast('wizard', 0, new Vector3(0, 0, 12));
    sc.update(0.3);
    const r = runes(scene);
    expect(r.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...r.map((m) => m.position.y))).toBeGreaterThan(4);
  });
});

describe('SpellCast fire (v12: the reel\'s fireball)', () => {
  it('a fireball lands as a volumetric explosion and leaves the ground burning', () => {
    const { host } = fakeHost();
    const sc = new SpellCast(host);
    sc.cast('wizard', 0, new Vector3(0, 0, 12));
    for (let i = 0; i < 10; i++) sc.update(0.1);
    expect(sc.explosions.live).toBeGreaterThan(30);
    expect(sc.fires.live).toBeGreaterThanOrEqual(15);
  });
  it('a mob standing in the fire burns, a little every half second', () => {
    const e = { id: 1, alive: true, pos: new Vector3(0, 0, 12), def: {} } as never;
    let burns = 0;
    const { host } = fakeHost({ enemies: [e], hit: (_e, mult) => { if (mult < 0.5) burns++; } });
    const sc = new SpellCast(host);
    sc.fires.ignite(new Vector3(0, 0, 12), 1, 10, () => 0);
    for (let i = 0; i < 30; i++) sc.update(0.1);
    expect(burns).toBeGreaterThanOrEqual(4);
  });
});

function mob(x: number, z: number) {
  return { id: Math.random(), alive: true, pos: new Vector3(x, 0, z), def: { height: 1.8 }, held: false, thrown: null as unknown, object: new Group(), shove() {}, afflict() {} };
}

describe('SpellCast black hole (v12: in the sky, as in the reel)', () => {
  const coreY = (scene: Group) => { let y = -Infinity; scene.traverse((o) => { if (o.name === 'core') y = o.getWorldPosition(new Vector3()).y; }); return y; };
  it('opens 8-12 m above where it is aimed', () => {
    const { host, scene } = fakeHost();
    const sc = new SpellCast(host);
    sc.cast('wizard', 1, new Vector3(0, 2, 10));
    sc.update(0.1);
    scene.updateMatrixWorld(true);
    expect(coreY(scene)).toBeGreaterThanOrEqual(10);
    expect(coreY(scene)).toBeLessThanOrEqual(14);
  });
  it('tears what stands under it apart block by block, all the time it is open', () => {
    const tears: number[] = [];
    const { host } = fakeHost({ tear: (_x, _z, r, n) => { tears.push(r); return n; } });
    const sc = new SpellCast(host);
    sc.cast('wizard', 1, new Vector3(0, 0, 10));
    for (let i = 0; i < 40; i++) sc.update(0.1);
    expect(tears.length).toBeGreaterThan(10);
    expect(Math.min(...tears)).toBeGreaterThanOrEqual(6);
  });
  it('lifts mobs up into it, spiralling, and flings them out when it collapses', () => {
    const e = mob(3, 10);
    const { host } = fakeHost({ enemies: [e as never] });
    const sc = new SpellCast(host);
    sc.cast('wizard', 1, new Vector3(0, 0, 10));
    let top = 0;
    for (let i = 0; i < 30; i++) { sc.update(0.1); top = Math.max(top, e.pos.y); }
    expect(e.held).toBe(true);
    expect(top).toBeGreaterThan(4);
    for (let i = 0; i < 60; i++) sc.update(0.1);
    expect(e.held).toBe(false);
    expect(e.thrown).toBeTruthy();
  });
  it('rubble rises up into it', () => {
    const { host, sim } = fakeHost();
    const p = sim.add({ x: 3, y: 0.3, z: 10, r: 0.3, box: { x: 0.2, y: 0.2, z: 0.2 }, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, density: 2000 });
    const sc = new SpellCast(host);
    sc.cast('wizard', 1, new Vector3(0, 0, 10));
    let top = 0;
    for (let i = 0; i < 25; i++) { sc.update(0.1); sim.step(0.1); top = Math.max(top, p.y); }
    expect(top).toBeGreaterThan(4);
  });
});

describe('SpellCast tornadoes (v12: the reel\'s, fire and storm)', () => {
  const named = (scene: Group, n: string) => { let f = null as null | { scale: Vector3 }; scene.traverse((o) => { if (o.name === n) f = o; }); return f; };
  for (const [hero, slot, label] of [['wizard', 2, 'fire'], ['archer', 4, 'storm']] as const) {
    it(`${label}: tears buildings apart, sucks a mob up its funnel and flings it out, burns the ground it crosses`, () => {
      const tears: number[] = [];
      const e = mob(0, 6);
      const { host } = fakeHost({ enemies: [e as never], tear: (_x, _z, r, n) => { tears.push(r); return n; } });
      host.controller.yaw = Math.PI / 2;
      const sc = new SpellCast(host);
      sc.cast(hero, slot, new Vector3(0, 0, 6));
      let top = 0, held = false, fires = 0;
      for (let i = 0; i < 90; i++) { sc.update(0.1); top = Math.max(top, e.pos.y); held ||= e.held; fires = Math.max(fires, sc.fires.live); }
      expect(tears.length).toBeGreaterThan(8);
      expect(held).toBe(true);
      expect(top).toBeGreaterThan(3);
      expect(e.held).toBe(false);
      expect(e.thrown).toBeTruthy();
      expect(fires).toBeGreaterThan(label === 'fire' ? 10 : 2);
    });
  }
  it('storm: a grey funnel under a dark storm cloud spreading wide over the sky, gone when it ends', () => {
    const { host, scene } = fakeHost();
    const sc = new SpellCast(host);
    sc.cast('archer', 4, new Vector3(0, 0, 10));
    for (let i = 0; i < 20; i++) sc.update(0.1);
    expect(named(scene, 'storm-funnel')).toBeTruthy();
    // The shelf cloud: billowing puffs hanging over it, spread wide.
    expect(sc.explosions.live).toBeGreaterThanOrEqual(40);
    expect(sc.explosions.meanY()).toBeGreaterThan(9);
    expect(sc.explosions.extent(new Vector3(0, 0, 10))).toBeGreaterThan(12);
    for (let i = 0; i < 80; i++) sc.update(0.1);
    expect(named(scene, 'storm-funnel')).toBeNull();
  });
});

describe('SpellCast Stone Wall (v12: Sir Aldric pulls a wall of stone out of the ground and kicks it apart)', () => {
  const wall = (scene: Group) => { let w: Group | null = null; scene.traverse((o) => { if (o.name === 'stone-wall') w = o as Group; }); return w as Group | null; };
  const blocks = (w: Group) => w.children.filter((c) => c.name === 'chunk');
  it('a wall of stone blocks rises at the crosshair, across his line of sight, solid to walk into', () => {
    let solids = 0;
    const { host, scene } = fakeHost({ solid: () => { solids++; return () => { solids--; }; } });
    host.controller.yaw = Math.PI / 2;
    const sc = new SpellCast(host);
    sc.cast('knight', 4, new Vector3(0, 0, 8));
    for (let i = 0; i < 10; i++) sc.update(0.1);
    const w = wall(scene)!;
    expect(w).toBeTruthy();
    const b = blocks(w);
    expect(b.length).toBeGreaterThanOrEqual(30);
    const xs = b.map((o) => o.position.x), zs = b.map((o) => o.position.z), ys = b.map((o) => o.position.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(4);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(1.2);
    expect(Math.max(...ys)).toBeGreaterThan(3.2);
    expect(solids).toBeGreaterThanOrEqual(4);
    expect(sc.wallUp()).toBe(true);
  });
  it('kicked, its blocks fly along his facing and smash into mobs behind it', () => {
    let solids = 0;
    const e = mob(0, 13);
    const hits: unknown[] = [];
    const { host, sim } = fakeHost({ enemies: [e as never], solid: () => { solids++; return () => { solids--; }; }, hit: (x) => hits.push(x) });
    host.controller.yaw = Math.PI / 2;
    const sc = new SpellCast(host);
    sc.cast('knight', 4, new Vector3(0, 0, 8));
    for (let i = 0; i < 10; i++) sc.update(0.1);
    sc.kickWall();
    expect(sc.wallUp()).toBe(false);
    expect(solids).toBe(0);
    const vz = sim.pieces.reduce((a, p) => a + p.vz, 0) / sim.pieces.length;
    expect(sim.pieces.length).toBeGreaterThanOrEqual(30);
    expect(vz).toBeGreaterThan(8);
    for (let i = 0; i < 10; i++) { sim.step(0.05); sc.update(0.05); }
    expect(hits).toContain(e);
  });
  it('left standing, it crumbles after about ten seconds', () => {
    let solids = 0;
    const { host, sim } = fakeHost({ solid: () => { solids++; return () => { solids--; }; } });
    const sc = new SpellCast(host);
    sc.cast('knight', 4, new Vector3(0, 0, 8));
    for (let i = 0; i < 115; i++) sc.update(0.1);
    expect(sc.wallUp()).toBe(false);
    expect(solids).toBe(0);
    expect(sim.pieces.length).toBeGreaterThan(0);
  });
});

describe('SpellCast Stone Wall before its model has loaded', () => {
  it('raises nothing and breaks nothing (the dust and rumble still come)', () => {
    const { host, scene } = fakeHost({ model: () => null });
    const sc = new SpellCast(host);
    expect(() => { sc.cast('knight', 4, new Vector3(0, 0, 8)); for (let i = 0; i < 5; i++) sc.update(0.1); }).not.toThrow();
    expect(sc.wallUp()).toBe(false);
    let w = false;
    scene.traverse((o) => { if (o.name === 'stone-wall') w = true; });
    expect(w).toBe(false);
  });
});

describe('SpellCast Earthsplitter (v12: slabs of stone burst up round where he lands)', () => {
  it('a ring of tilted stone slabs juts out of the ground round the crater, then breaks up into rubble', () => {
    const { host, scene, sim } = fakeHost();
    host.controller.yaw = Math.PI / 2;
    const sc = new SpellCast(host);
    sc.cast('knight', 0, new Vector3(0, 0, 6));
    for (let i = 0; i < 10; i++) sc.update(0.1);
    let g: Group | null = null;
    scene.traverse((o) => { if (o.name === 'stone-slabs') g = o as Group; });
    expect(g).toBeTruthy();
    const slabs = (g as unknown as Group).children.filter((c) => c.name === 'chunk');
    expect(slabs.length).toBeGreaterThanOrEqual(10);
    const mid = new Vector3();
    for (const b of slabs) mid.add(b.position);
    mid.divideScalar(slabs.length);
    for (const b of slabs) {
      const out = new Vector3(b.position.x - mid.x, 0, b.position.z - mid.z).normalize();
      const up = new Vector3(0, 1, 0).applyQuaternion(b.quaternion);
      expect(up.dot(out)).toBeGreaterThan(0.2);
    }
    for (let i = 0; i < 40; i++) sc.update(0.1);
    expect(sim.pieces.length).toBeGreaterThanOrEqual(10);
  });
});

describe('SpellCast.impact (v12: every spell hit lands as the reel\'s blast)', () => {
  it('a hot impact billows, tears blocks loose and leaves fires', () => {
    const tears: number[] = [];
    const { host } = fakeHost({ tear: (_x, _z, _r, n) => { tears.push(n); return n; } });
    const sc = new SpellCast(host);
    sc.impact(new Vector3(0, 0, 5), 0xffd27a, 2, { fires: 4, tear: 5 });
    sc.update(0.1);
    expect(sc.explosions.live).toBeGreaterThan(15);
    expect(sc.fires.live).toBe(4);
    expect(tears).toEqual([5]);
  });
  it('a cold one billows without fires', () => {
    const { host } = fakeHost();
    const sc = new SpellCast(host);
    sc.impact(new Vector3(0, 0, 5), 0x7fe8ff, 2);
    sc.update(0.1);
    expect(sc.explosions.live).toBeGreaterThan(15);
    expect(sc.fires.live).toBe(0);
  });
});

describe('SpellCast older spells use the v12 blasts', () => {
  const run = (hero: string, slot: number, over: Partial<SpellHost> = {}) => {
    const tears: number[] = [];
    const { host } = fakeHost({ tear: (_x, _z, _r, n) => { tears.push(n); return n; }, ...over });
    const sc = new SpellCast(host);
    sc.cast(hero, slot, new Vector3(0, 0, 10));
    for (let i = 0; i < 12; i++) sc.update(0.1);
    return { sc, tears };
  };
  it('storm arrow: a blast and a few fires where the bolt strikes', () => {
    const { sc } = run('archer', 2);
    expect(sc.explosions.live).toBeGreaterThan(15);
    expect(sc.fires.live).toBeGreaterThanOrEqual(3);
  });
  it('frost arrow: an icy burst, nothing burning', () => {
    const { sc } = run('archer', 1);
    expect(sc.explosions.live).toBeGreaterThan(15);
    expect(sc.fires.live).toBe(0);
  });
  it('gale shot tears blocks loose down its cone', () => {
    const { tears } = run('archer', 3);
    expect(tears.length).toBeGreaterThanOrEqual(3);
  });
  it('wrecking charge tears blocks loose along its rush', () => {
    const { tears } = run('knight', 1);
    expect(tears.length).toBeGreaterThanOrEqual(2);
  });
  it('earthsplitter tears the blocks off what it lands by', () => {
    const { tears } = run('knight', 0);
    expect(tears.length).toBeGreaterThanOrEqual(1);
  });
});

describe('SpellCast.skillImpact (the 1-2 slot skills land as v12 blasts)', () => {
  const at = new Vector3(0, 0, 5);
  const one = (kind: Parameters<SpellCast['skillImpact']>[0]) => {
    const tears: number[] = [];
    const { host } = fakeHost({ tear: (_x, _z, _r, n) => { tears.push(n); return n; } });
    const sc = new SpellCast(host);
    sc.skillImpact(kind, at, 0xff3a4a);
    sc.update(0.1);
    return { sc, tears };
  };
  it('a falling star: a blast, a couple of fires, blocks off', () => {
    const { sc, tears } = one('star');
    expect(sc.explosions.live).toBeGreaterThan(15);
    expect(sc.fires.live).toBeGreaterThanOrEqual(2);
    expect(tears[0]).toBeGreaterThan(0);
  });
  it('the crescent breaking: a blast and blocks off, no fire (it burns its own ground)', () => {
    const { sc, tears } = one('crescent');
    expect(sc.explosions.live).toBeGreaterThan(15);
    expect(sc.fires.live).toBe(0);
    expect(tears[0]).toBeGreaterThan(0);
  });
  it('a volley arrow: a small puff, a block or two', () => {
    const { sc, tears } = one('arrow');
    expect(sc.explosions.live).toBeGreaterThan(0);
    expect(sc.explosions.live).toBeLessThanOrEqual(40);
    expect(tears[0]).toBeGreaterThan(0);
  });
});

describe('SpellCast overgrowth (v12)', () => {
  it('its roots prise blocks off anything built where it grows', () => {
    const tears: number[] = [];
    const { host } = fakeHost({ tear: (_x, _z, _r, n) => { tears.push(n); return n; } });
    new SpellCast(host).cast('wizard', 3, new Vector3(0, 0, 8));
    expect(tears.length).toBe(1);
  });
});

describe('SpellCast warns the mobs under its rune circles', () => {
  it('a mob inside the circle is told to dodge, one far off is not', () => {
    const asked: number[] = [];
    const near = { ...mob(0, 11), dodge: () => { asked.push(1); return false; } };
    const far = { ...mob(40, 40), dodge: () => { asked.push(2); return false; } };
    const { host } = fakeHost({ enemies: [near, far] as never });
    new SpellCast(host).cast('wizard', 0, new Vector3(0, 0, 12));
    expect(asked).toEqual([1]);
  });
});

describe('SpellCast lasting spells keep sounding (v12 sound beds)', () => {
  it('the black hole, both tornadoes and a fireball\'s fires start a bed', () => {
    const beds: string[] = [];
    for (const [hero, slot] of [['wizard', 1], ['wizard', 2], ['archer', 4], ['wizard', 0]] as const) {
      const { host } = fakeHost({ audio: new Proxy({}, { get: (_t, k) => (...a: unknown[]) => { if (k === 'bed') beds.push(String(a[0])); } }) as SpellHost['audio'] });
      const sc = new SpellCast(host);
      sc.cast(hero, slot, new Vector3(0, 0, 10));
      for (let i = 0; i < 10; i++) sc.update(0.1);
    }
    expect(beds).toEqual(['hole', 'tornado', 'fire', 'tornado', 'fire']);
  });
});

describe('review 2026-11-16 fixes', () => {
  it('fire ticks are burns (damage over time), not heavy hits', () => {
    const e = { id: 1, alive: true, pos: new Vector3(0, 0, 12), def: {} } as never;
    let burns = 0, hits = 0;
    const { host } = fakeHost({ enemies: [e], hit: () => { hits++; }, burn: () => { burns++; } });
    const sc = new SpellCast(host);
    sc.fires.ignite(new Vector3(0, 0, 12), 1, 10, () => 0);
    for (let i = 0; i < 30; i++) sc.update(0.1);
    expect(burns).toBeGreaterThanOrEqual(4);
    expect(hits).toBe(0);
  });
  it('the wall is kicked along the way he faces when he kicks, not when he raised it', () => {
    const { host, sim } = fakeHost();
    const sc = new SpellCast(host);
    host.controller.yaw = Math.PI / 2;
    sc.cast('knight', 4, new Vector3(0, 0, 6));
    for (let i = 0; i < 10; i++) sc.update(0.1);
    // He walks round it and kicks back the other way (-z).
    host.controller.yaw = -Math.PI / 2;
    sc.kickWall();
    let vz = 0, n = 0;
    for (const p of sim.pieces) { vz += p.vz; n++; }
    expect(n).toBeGreaterThan(10);
    expect(vz / n).toBeLessThan(-8);
  });
});

describe('the black hole\'s collapse (critic round 2: it burst as a flat white disc)', () => {
  it('bursts deep violet, not near-white, with a flash that lights the scene without blowing it out', () => {
    const hsl = new Color(HOLE_BURST.hot).getHSL({ h: 0, s: 0, l: 0 });
    expect(hsl.s).toBeGreaterThanOrEqual(0.8);
    expect(hsl.l).toBeLessThanOrEqual(0.7);
    expect(HOLE_BURST.flash).toBeLessThanOrEqual(70);
  });
});

describe('Wrecking Charge leaves a speed wake (critic round 3: the rush showed nothing on screen)', () => {
  it('feeds a ribbon trail behind him while he rushes, and lets it go when the rush ends', () => {
    const trails: Array<{ id: string; on: boolean; ay: number; by: number }> = [];
    const fx = new Proxy({}, { get: (_t, k) => (...a: unknown[]) => {
      if (k === 'trail') trails.push({ id: a[0] as string, on: a[4] as boolean, ay: (a[1] as Vector3).y, by: (a[2] as Vector3).y });
    } }) as SpellHost['fx'];
    const { host } = fakeHost({ fx });
    const sc = new SpellCast(host);
    sc.cast('knight', 1, new Vector3(0, 0, 10));
    for (let i = 0; i < 10; i++) sc.update(0.1);
    const fed = trails.filter((t) => t.on);
    expect(fed.length).toBeGreaterThanOrEqual(3);
    expect(new Set(fed.map((t) => t.id)).size).toBe(1);
    // A tall ribbon, from about the knees to the shoulders.
    expect(fed[0].by - fed[0].ay).toBeGreaterThan(0.8);
    expect(trails[trails.length - 1].on).toBe(false);
  });
});

describe('Gale Shot shows its wind (critic round 3: the cone was invisible but for a little dust)', () => {
  it('sweeps wind fronts across its cone, out to its reach, along her heading', () => {
    const arcs: Array<{ yaw: number; radius: number; half: number }> = [];
    const fx = new Proxy({}, { get: (_t, k) => (...a: unknown[]) => {
      if (k === 'arc') arcs.push({ yaw: a[1] as number, radius: a[3] as number, half: a[5] as number });
    } }) as SpellHost['fx'];
    const { host } = fakeHost({ fx });
    host.controller.yaw = 0.7;
    const sc = new SpellCast(host);
    sc.cast('archer', 3, new Vector3(0, 0, 10));
    for (let i = 0; i < 6; i++) sc.update(0.1);
    expect(arcs.length).toBeGreaterThanOrEqual(3);
    for (const a of arcs) { expect(a.yaw).toBeCloseTo(0.7, 5); expect(a.half).toBeCloseTo(0.55, 5); }
    expect(Math.max(...arcs.map((a) => a.radius))).toBeGreaterThanOrEqual(8);
  });
});

