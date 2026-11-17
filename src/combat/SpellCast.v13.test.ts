import { describe, expect, it } from 'vitest';
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { EARTH_DUST, SpellCast } from './SpellCast';
import { SPELLS } from './Spells';
import { fakeHost } from './spellHost.fixture';
import { bloodSky } from './CombatSystem';

function mob(x: number, z: number, o: Record<string, unknown> = {}) {
  return {
    id: Math.random(), alive: true, swallow: -1, pos: new Vector3(x, 0, z), def: { height: 1.8, speed: 3, bodyRadius: 0.4 }, held: false, thrown: null as unknown,
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
    // (Review: it was set back to full size, and the death fade showed it again. It stays swallowed: the body keeps
    // it hidden, Enemy's own death path included.)
    expect((e as unknown as { swallow: number }).swallow).toBeLessThan(0.06);
    expect(e.object.scale.x).toBeLessThan(0.06);
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

describe('Earthsplitter: he kneels and a fissure of spiky rocks runs to the crosshair (playtest 2026-11-17: no leap)', () => {
  const rockModel = () => { const g = new Group(); g.add(new Mesh(new BoxGeometry(1, 3, 1), new MeshStandardMaterial())); return g; };
  it('he stays where he is; mobs along the line are hit and tossed, ones off it are not', () => {
    const near = mob(0.8, 6), off = mob(5, 5);
    const hit = new Set<unknown>();
    const leaps: unknown[] = [];
    (near as { leap: () => void }).leap = () => { leaps.push(near); };
    const { host } = fakeHost({
      enemies: [near as never, off as never],
      reachable: (e, r, at) => Math.hypot(e.pos.x - at.x, e.pos.z - at.z) <= r,
      hit: (e) => { hit.add(e); },
      model: (id) => (id === 'pinnacle' || id === 'spiky-rock' ? rockModel() : null),
    });
    const sc = new SpellCast(host);
    host.controller.yaw = Math.PI / 2;
    sc.cast('knight', 0, new Vector3(0, 0, 10));
    let most = 0;
    for (let i = 0; i < 20; i++) { sc.update(0.1); most = Math.max(most, sc.spikes.count); }
    expect(Math.hypot(host.controller.pos.x, host.controller.pos.z)).toBeLessThan(1e-6);
    expect(hit.has(near)).toBe(true);
    expect(leaps.length).toBeGreaterThan(0);
    expect(hit.has(off)).toBe(false);
    expect(most).toBeGreaterThan(12);
  });
});

describe('Stone Wall is an earth wall of jagged rock, not bricks (playtest 2026-11-17)', () => {
  const rockModel = () => { const g = new Group(); g.add(new Mesh(new BoxGeometry(1, 3, 1), new MeshStandardMaterial())); return g; };
  const host = () => {
    const wallModel = new Group();
    const wm = new Mesh(new BoxGeometry(2.6, 1.2, 0.5, 8, 4, 2), new MeshStandardMaterial());
    wm.position.y = 0.6;
    wallModel.add(wm);
    return fakeHost({ model: (id) => (id === 'pinnacle' ? rockModel() : id === 'stone-wall' ? wallModel : null), solid: () => () => {} });
  };
  it('jagged rocks burst up along it; its blocks are not shown while it stands', () => {
    const { host: h, scene } = host();
    const sc = new SpellCast(h);
    h.controller.yaw = 0;
    sc.cast('knight', 4, new Vector3(8, 0, 0));
    for (let i = 0; i < 5; i++) sc.update(0.1);
    expect(sc.spikes.count).toBeGreaterThanOrEqual(10);
    let blocks: Group | null = null;
    scene.traverse((o) => { if (o.name === 'stone-wall') blocks = o as Group; });
    expect(blocks).toBeTruthy();
    expect((blocks as unknown as Group).visible).toBe(false);
  });
  it('kicked, the rocks sink and its stones fly', () => {
    const { host: h, scene } = host();
    const sc = new SpellCast(h);
    h.controller.yaw = 0;
    sc.cast('knight', 4, new Vector3(8, 0, 0));
    for (let i = 0; i < 5; i++) sc.update(0.1);
    sc.kickWall();
    for (let i = 0; i < 8; i++) sc.update(0.1);
    expect(sc.spikes.count).toBe(0);
    let blocks: Group | null = null;
    scene.traverse((o) => { if (o.name === 'stone-wall') blocks = o as Group; });
    expect((blocks as unknown as Group).visible).toBe(true);
  });
});

describe('Stone Wall never shows bricks (headless check: worn out, the dry-stone wall stood up again, then fell)', () => {
  const rockModel = () => { const g = new Group(); g.add(new Mesh(new BoxGeometry(1, 3, 1, 4, 6, 4), new MeshStandardMaterial())); return g; };
  it('its stones are cut from the rock, so it rises with only the rock model loaded', () => {
    const rock = rockModel();
    const { host: h } = fakeHost({ model: (id) => (id === 'pinnacle' ? rock : null), solid: () => () => {} });
    const sc = new SpellCast(h);
    expect(sc.wallLoaded()).toBe(true);
  });
  it('worn out, the rocks sink and no block shows', () => {
    const rock = rockModel();
    const { host: h, scene } = fakeHost({ model: (id) => (id === 'pinnacle' ? rock : null), solid: () => () => {} });
    const sc = new SpellCast(h);
    h.controller.yaw = 0;
    sc.cast('knight', 4, new Vector3(8, 0, 0));
    for (let i = 0; i < 110; i++) sc.update(0.1);
    expect(sc.wallUp()).toBe(false);
    let blocks: Group | null = null;
    scene.traverse((o) => { if (o.name === 'stone-wall') blocks = o as Group; });
    expect(blocks === null || (blocks as unknown as Group).visible === false).toBe(true);
  });
});

describe('Rock Armor halves what the hero takes while it lasts', () => {
  it('armorShare', async () => {
    const { armorShare } = await import('./CombatSystem');
    expect(armorShare(0)).toBe(1);
    expect(armorShare(3)).toBe(0.5);
  });
});

describe('ice raised before its model loaded shows once it has (review: an invisible ice wall with a solid collider)', () => {
  it('the ice wall keeps its crystals when the field is rebuilt with the model', () => {
    let loaded = false;
    const rock = () => { const g = new Group(); g.add(new Mesh(new BoxGeometry(1, 3, 1), new MeshStandardMaterial())); return g; };
    const { host } = fakeHost({ model: (id) => (loaded && id === 'purple-crystal' ? rock() : null), solid: () => () => {} });
    const sc = new SpellCast(host);
    const slot = SPELLS.archer.findIndex((s) => s.id === 'ice-wall');
    sc.cast('archer', slot, new Vector3(0, 0, 8));
    sc.update(0.1);
    const before = sc.ice.count;
    expect(before).toBeGreaterThan(5);
    loaded = true;
    sc.update(0.1);
    expect(sc.ice.mesh).not.toBeNull();
    expect(sc.ice.count).toBe(before);
  });
});

describe('Earthsplitter bursts on what it was aimed at (review: a deck above him burst on the ground under it)', () => {
  it('aimed at a deck 4 m up, the end burst is on the deck', () => {
    const ys: number[] = [];
    // (A deck 4 m up over x 0, z 6-10: what stands on it, or comes from above, is on it.)
    const { host } = fakeHost({ smash: (_x, y) => { ys.push(y); }, heightAt: (_x, z, y) => (z > 6 && z < 10 && (y ?? 0) > 4 ? 4 : 0) });
    const sc = new SpellCast(host);
    host.controller.yaw = Math.PI / 2;
    sc.cast('knight', 0, new Vector3(0, 4, 8));
    for (let i = 0; i < 10; i++) sc.update(0.1);
    expect(Math.max(...ys)).toBeGreaterThan(4.4);
  });
});

describe('earth moves burst in dust, not fire (headless check: Earthsplitter\'s end flashed white-hot)', () => {
  const run = (hero: 'knight', id: string) => {
    const { host, log } = fakeHost();
    const sc = new SpellCast(host);
    const hots: number[] = [];
    const orig = sc.explosions.burst.bind(sc.explosions);
    sc.explosions.burst = (at, r, o = {}) => { hots.push(o.hot ?? 0xff7a1a); orig(at, r, o); };
    host.controller.yaw = Math.PI / 2;
    sc.cast(hero, SPELLS[hero].findIndex((s) => s.id === id), new Vector3(0, 0, 8));
    log.length = 0; // (the cast's own small glow in the hand is every spell's; the impact is what is judged)
    for (let i = 0; i < 30; i++) sc.update(0.1);
    return { hots, log };
  };
  for (const id of ['earthsplitter', 'boulder']) {
    it(`${id}: no white flash, every cloud is earth-coloured`, () => {
      const { hots, log } = run('knight', id);
      expect(hots.length).toBeGreaterThan(0);
      for (const c of hots) expect(c).toBe(EARTH_DUST);
      expect(log.filter((k) => k === 'flash').length).toBe(0);
    });
  }
});

describe('the ice moves to its own model once it loads (headless check: the wall stayed on the violet stand-in)', () => {
  it('raised on the stand-in, it is drawn with ice-crystal after that loads, every crystal kept', () => {
    let own = false;
    const box = () => { const g = new Group(); g.add(new Mesh(new BoxGeometry(1, 3, 1), new MeshStandardMaterial())); return g; };
    const stand = box(), ice = box();
    const { host } = fakeHost({ model: (id) => (id === 'purple-crystal' ? stand : id === 'ice-crystal' && own ? ice : null), solid: () => () => {} });
    const sc = new SpellCast(host);
    sc.cast('archer', SPELLS.archer.findIndex((s) => s.id === 'ice-wall'), new Vector3(0, 0, 8));
    sc.update(0.1);
    const before = sc.ice.count;
    const first = sc.ice.mesh;
    expect(first).not.toBeNull();
    own = true;
    sc.update(0.1);
    expect(sc.ice.mesh).not.toBe(first);
    expect(sc.ice.count).toBe(before);
  });
});
