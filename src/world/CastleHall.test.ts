import { Group } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CASTLE_HALL, LAYOUT, REALMS } from '../data/world';

// No GLB fetches or canvases in node.
vi.mock('../models/ModelRig', () => ({ loadModelOrWarn: () => Promise.resolve(null), ModelRig: class {}, yawToRotation: (y: number) => y }));
vi.mock('../render/Glow', () => ({ glowSprite: () => new Group(), glowTexture: () => null }));
vi.mock('../render/MoonFace', () => ({ faceMoon: () => ({ group: new Group(), ready: Promise.resolve(false), update: () => {}, tint: null }) }));

describe('the Moon Throne Hall inside the island castle', async () => {
  const { buildCastleHall, CASTLE_GATE } = await import('./CastleHall');
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

  it('is entered with F at the castle gate, on the island, and left by its own door', () => {
    const into = doors.find((d) => d.zone === null)!;
    expect(into.label()).toMatch(/castle/i);
    expect(Math.hypot(into.pos.x - CASTLE_GATE.x, into.pos.z - CASTLE_GATE.z)).toBeLessThan(0.01);
    expect(Math.hypot(CASTLE_GATE.x - LAYOUT.castle.x, CASTLE_GATE.z - LAYOUT.castle.z)).toBeLessThan(20);
    into.act();
    const [x, , z] = teleport.mock.calls[0] as number[];
    expect(Math.abs(x - CASTLE_HALL.x)).toBeLessThan(13);
    expect(Math.abs(z - CASTLE_HALL.z)).toBeLessThan(13);
    const out = doors.find((d) => d.zone === CASTLE_HALL.id && /leave/i.test(d.label() ?? ''))!;
    out.act();
    const [bx, , bz] = teleport.mock.calls[1] as number[];
    expect(Math.hypot(bx - CASTLE_GATE.x, bz - CASTLE_GATE.z)).toBeLessThan(4);
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
