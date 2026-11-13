import { Group } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CASTLE_HALL, REALMS } from '../data/world';

// No GLB fetches or canvases in node.
vi.mock('../models/ModelRig', () => ({ loadModelOrWarn: () => Promise.resolve(null), ModelRig: class {}, yawToRotation: (y: number) => y }));
vi.mock('../render/Glow', () => ({ glowSprite: () => new Group(), glowTexture: () => null }));
vi.mock('../render/MoonFace', () => ({ faceMoon: () => ({ group: new Group(), ready: Promise.resolve(false), update: () => {}, tint: null }) }));

describe('the Moon Throne Hall inside the island castle', async () => {
  const { buildCastleHall, CASTLE_DOOR, CASTLE_GATE } = await import('./CastleHall');
  const { SINK } = await import('../data/world');
  const placed: Array<{ footprints: Array<{ kind: string; x: number; z: number; top: number; bottom?: number }> }> = [];
  const api = {
    group: new Group(), realm: () => {}, place: (l: never) => { placed.push(l); }, flora: () => {}, vfx: () => {}, h: () => 3, rnd: () => 0.5,
  };
  const teleport = vi.fn();
  const reward = vi.fn();
  const doors = buildCastleHall(api as never, teleport, reward, () => 3);

  it('is a realm of its own, indoors', () => {
    expect(REALMS).toContain(CASTLE_HALL);
    expect(CASTLE_HALL.indoors).toBe(true);
  });

  it('is entered with F at the castle\'s door, at the top of its stairs (it was at their foot, 6 m under the door: the playtest of 2026-11-13), and left by its own door back onto that landing', () => {
    const into = doors.find((d) => d.zone === null)!;
    expect(into.label()).toMatch(/castle/i);
    expect(Math.hypot(into.pos.x - CASTLE_DOOR.x, into.pos.z - CASTLE_DOOR.z)).toBeLessThan(0.01);
    expect(into.pos.y).toBeCloseTo(3 - SINK.castle + CASTLE_DOOR.rise, 6);
    expect(Math.hypot(CASTLE_DOOR.x - CASTLE_GATE.x, CASTLE_DOOR.z - CASTLE_GATE.z)).toBeGreaterThan(4);
    into.act();
    const [x, , z] = teleport.mock.calls[0] as number[];
    expect(Math.abs(x - CASTLE_HALL.x)).toBeLessThan(13);
    expect(Math.abs(z - CASTLE_HALL.z)).toBeLessThan(13);
    const out = doors.find((d) => d.zone === CASTLE_HALL.id && /leave/i.test(d.label() ?? ''))!;
    out.act();
    const [bx, by, bz] = teleport.mock.calls[1] as number[];
    expect(Math.hypot(bx - CASTLE_DOOR.x, bz - CASTLE_DOOR.z)).toBeLessThan(2);
    expect(by).toBeCloseTo(into.pos.y, 6);
    // (On its own landing, not a metre over the treads below it: the review.)
    const under = placed.flatMap((l) => l.footprints ?? []).filter((f) => f.kind === 'box' && Math.abs(f.x - bx) < 1.6 && Math.abs(f.z - bz) < 0.3);
    expect(under.length).toBeGreaterThan(0);
    expect(Math.max(...under.map((f) => f.top)) - by).toBeGreaterThan(-0.3);
  });

  it('climbs its stairs from the ground to the door by treads no higher than a step (one riser was 0.66 m: nobody could walk up)', () => {
    const treads = placed.flatMap((l) => l.footprints ?? []).filter((f) => f.kind === 'box' && Math.abs(f.x - CASTLE_DOOR.x) < 0.01 && f.z > CASTLE_DOOR.z - 0.01 && f.z < CASTLE_GATE.z + 0.5).sort((a, b) => b.z - a.z);
    expect(treads.length).toBeGreaterThan(5);
    expect(treads[0].top - 3).toBeLessThan(0.4);
    for (let i = 1; i < treads.length; i++) expect(treads[i].top - treads[i - 1].top).toBeLessThan(0.4);
    expect(treads.at(-1)!.top).toBeCloseTo(3 - SINK.castle + CASTLE_DOOR.rise, 6);
  });

  it('has a throne at the far end that blesses whoever sits on it', () => {
    const throne = doors.find((d) => /throne/i.test(d.label() ?? ''))!;
    expect(throne.zone).toBe(CASTLE_HALL.id);
    throne.act();
    expect(reward).toHaveBeenCalledWith('throne');
    expect(throne.label()).toBeNull(); // spent for a while
  });

  it('has a floor, walls and a vault, and its pillars stand solid', () => {
    const all = placed.flatMap((l) => l.footprints ?? []);
    expect(all.some((f) => f.kind === 'box' && f.top === CASTLE_HALL.y)).toBe(true);
    expect(all.filter((f) => f.kind === 'cyl').length).toBeGreaterThanOrEqual(16);
  });
});
