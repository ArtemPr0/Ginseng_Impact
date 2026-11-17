import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { SpellCast } from './SpellCast';
import { fakeHost } from './spellHost.fixture';
import { SPELLS, PAGE2 } from './Spells';

function mob(x: number, z: number) {
  return {
    id: Math.random(), alive: true, pos: new Vector3(x, 0, z), def: { height: 1.8, speed: 3, bodyRadius: 0.4 }, held: false, thrown: null as unknown,
    object: new Group(), leaps: 0, shove() {}, afflict() {}, leap() { this.leaps++; }, dodge() {},
  };
}
type M = ReturnType<typeof mob>;
const rock = () => { const g = new Group(); g.add(new Mesh(new BoxGeometry(1, 3, 1), new MeshStandardMaterial())); return g; };

/** Casts page-2 move `id` facing +z at `aim` with `mobs` about; returns who was hit (and how often), what stood up. */
function run(hero: string, id: string, aim: Vector3, mobs: M[], seconds = 3) {
  const hits = new Map<M, number>();
  const solids: Array<{ top: number; gone: boolean }> = [];
  let armor = 0;
  const { host, sim } = fakeHost({
    enemies: mobs as never,
    reachable: (e, r, at) => Math.hypot(e.pos.x - at.x, e.pos.z - at.z) <= r + 0.4,
    hit: (e) => { hits.set(e as unknown as M, (hits.get(e as unknown as M) ?? 0) + 1); },
    model: (m) => (m === 'pinnacle' || m === 'purple-crystal' || m === 'boulder' ? rock() : null),
    solid: (_x, _z, _r, top) => { const s = { top, gone: false }; solids.push(s); return () => { s.gone = true; }; },
    armor: (s) => { armor = s; },
  });
  host.controller.yaw = Math.PI / 2;
  const sc = new SpellCast(host);
  const slot = SPELLS[hero].findIndex((s) => s.id === id);
  expect(slot).toBeGreaterThanOrEqual(5);
  sc.cast(hero, slot, aim);
  const start = { vy: host.controller.vel.y, dash: host.controller.dashLeft };
  for (let t = 0; t < seconds; t += 0.05) sc.update(0.05);
  return { hits, solids, armor, start, sim, sc };
}

describe('page 2: seven reel moves per hero (playtest 2026-11-17, the Flowbound reels)', () => {
  it('each hero has seven more spells, every one on the second page', () => {
    for (const hero of ['knight', 'archer', 'wizard']) {
      expect(SPELLS[hero]).toHaveLength(12);
      expect(PAGE2[hero]).toEqual(SPELLS[hero].slice(5).map((s) => s.id));
      for (const s of SPELLS[hero]) expect(s.icon).toMatch(/<(path|circle|polygon|line|ellipse|rect)/);
    }
  });
});

describe('Sir Aldric, earth', () => {
  it('Stone Ring: spikes erupt round him and fling the near ones out; far ones are safe', () => {
    const a = mob(0, 2.5), b = mob(0, 10);
    const r = run('knight', 'stone-ring', new Vector3(0, 0, 0), [a, b]);
    expect(r.hits.get(a)).toBeGreaterThan(0);
    expect(a.leaps).toBeGreaterThan(0);
    expect(r.hits.has(b)).toBe(false);
  });
  it('Spike Row: a long line of spikes to the crosshair', () => {
    const a = mob(0.6, 13), b = mob(4, 8);
    const r = run('knight', 'spike-row', new Vector3(0, 0, 16), [a, b]);
    expect(r.hits.get(a)).toBeGreaterThan(0);
    expect(r.hits.has(b)).toBe(false);
  });
  it('Boulder: torn up and hurled on an arc; it lands where aimed', () => {
    const a = mob(0, 12), b = mob(0, 3);
    const r = run('knight', 'boulder', new Vector3(0, 0, 12), [a, b]);
    expect(r.hits.get(a)).toBeGreaterThan(0);
    expect(r.hits.has(b)).toBe(false);
  });
  it('Pillars: three rise before him (solid), then burst forward into what is ahead', () => {
    const a = mob(0, 9);
    const r = run('knight', 'pillars', new Vector3(0, 0, 12), [a]);
    expect(r.solids.length).toBeGreaterThanOrEqual(3);
    expect(r.solids.every((s) => s.gone)).toBe(true);
    expect(r.hits.get(a)).toBeGreaterThan(0);
  });
  it('Earth Wall: a tall slab of earth before him, solid, then gone', () => {
    const r = run('knight', 'earth-wall', new Vector3(0, 0, 8), [], 12);
    expect(r.solids.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...r.solids.map((s) => s.top))).toBeGreaterThan(3);
    expect(r.solids.every((s) => s.gone)).toBe(true);
  });
  it('Dust Kick: a cone ahead is blasted back; behind him is not', () => {
    const a = mob(0, 3), b = mob(0, -3);
    const r = run('knight', 'dust-kick', new Vector3(0, 0, 8), [a, b]);
    expect(r.hits.get(a)).toBeGreaterThan(0);
    expect(r.hits.has(b)).toBe(false);
  });
  it('Rock Armor: he takes half damage for six seconds', () => {
    expect(run('knight', 'rock-armor', new Vector3(0, 0, 0), []).armor).toBe(6);
  });
});

describe('Orlan, fire', () => {
  it('Fire Jets: up into the air on jets of fire', () => {
    expect(run('wizard', 'fire-jets', new Vector3(0, 0, 5), [], 0.05).start.vy).toBeGreaterThan(8);
  });
  it('Fire Wave: a wall of flame sweeps forward', () => {
    const a = mob(0, 8), b = mob(0, -4);
    const r = run('wizard', 'fire-wave', new Vector3(0, 0, 12), [a, b]);
    expect(r.hits.get(a)).toBeGreaterThan(0);
    expect(r.hits.has(b)).toBe(false);
  });
  it('Fire Ring: fire bursts round the target', () => {
    const a = mob(3, 10), b = mob(0, 2);
    const r = run('wizard', 'fire-ring', new Vector3(0, 0, 10), [a, b]);
    expect(r.hits.get(a)).toBeGreaterThan(0);
    expect(r.hits.has(b)).toBe(false);
  });
  it('Fire Column: a pillar of flame throws them up', () => {
    const a = mob(1, 10);
    const r = run('wizard', 'fire-column', new Vector3(0, 0, 10), [a]);
    expect(r.hits.get(a)).toBeGreaterThan(0);
    expect(a.leaps).toBeGreaterThan(0);
  });
  it('Fire Dash: he dashes on a trail of fire, burning what he passes', () => {
    const a = mob(0.5, 5);
    const r = run('wizard', 'fire-dash', new Vector3(0, 0, 12), [a]);
    expect(r.start.dash).toBeGreaterThan(0);
    expect(r.hits.get(a)).toBeGreaterThan(0);
  });
  it('Flame Body: he burns, and what stands by him burns again and again', () => {
    const a = mob(1.5, 0), b = mob(6, 0);
    const r = run('wizard', 'flame-body', new Vector3(0, 0, 5), [a, b], 4);
    expect(r.hits.get(a)).toBeGreaterThanOrEqual(3);
    expect(r.hits.has(b)).toBe(false);
  });
  it('Fire Fist: a flaming fist flies at the crosshair', () => {
    const a = mob(0, 10);
    expect(run('wizard', 'fire-fist', new Vector3(0, 0, 10), [a]).hits.get(a)).toBeGreaterThan(0);
  });
});

describe('Wren, water and ice', () => {
  it('Ice Ramp: a solid path of ice rising ahead of her, gone in time', () => {
    const r = run('archer', 'ice-ramp', new Vector3(0, 0, 10), [], 12);
    expect(r.solids.length).toBeGreaterThanOrEqual(5);
    const tops = r.solids.map((s) => s.top);
    expect(tops[tops.length - 1]).toBeGreaterThan(tops[0]);
    expect(r.solids.every((s) => s.gone)).toBe(true);
  });
  it('Water Shield: a curved wall of water before her, solid', () => {
    const r = run('archer', 'water-shield', new Vector3(0, 0, 8), [], 1);
    expect(r.solids.length).toBeGreaterThanOrEqual(3);
  });
  it('Ice Shards: a burst of flying ice at the crosshair', () => {
    const a = mob(1, 10);
    const r = run('archer', 'ice-shards', new Vector3(0, 0, 10), [a]);
    expect(r.hits.get(a)).toBeGreaterThan(0);
    expect(r.sim.pieces.length).toBeGreaterThanOrEqual(8);
  });
  it('Water Whip: it lashes the one on her line and drags it in', () => {
    const a = mob(0.8, 9);
    const r = run('archer', 'water-whip', new Vector3(0, 0, 14), [a]);
    expect(r.hits.get(a)).toBeGreaterThan(0);
    expect(Math.hypot(a.pos.x, a.pos.z)).toBeLessThan(6);
  });
  it('Water Whip reaches as far as its preview lane (14 m), no further', () => {
    const a = mob(0.5, 18);
    const r = run('archer', 'water-whip', new Vector3(0, 0, 20), [a]);
    expect(r.hits.has(a)).toBe(false);
    expect(a.pos.z).toBe(18);
  });
  it('Wave Surf: she rides a wave forward and knocks them aside', () => {
    const a = mob(0.6, 5);
    const r = run('archer', 'wave-surf', new Vector3(0, 0, 12), [a]);
    expect(r.start.dash).toBeGreaterThan(0);
    expect(r.hits.get(a)).toBeGreaterThan(0);
  });
  it('Ice Wall: a wall of ice across the crosshair', () => {
    const r = run('archer', 'ice-wall', new Vector3(0, 0, 8), [], 1);
    expect(r.solids.length).toBeGreaterThanOrEqual(4);
  });
  it('Ice Discs: three blades of ice fly out; the one ahead is cut', () => {
    const a = mob(0, 9);
    expect(run('archer', 'ice-discs', new Vector3(0, 0, 12), [a]).hits.get(a)).toBeGreaterThan(0);
  });
});
