import { describe, expect, it } from 'vitest';
import { stoneArch, WITCH_BRIDGE, woodArch } from './Walkways';
import type { Footprint } from './Colliders';

// A chasm between two banks, like the island's (rims at z -34 and -79, the cloud sea at -90 below): the south bank at
// 4.2, the north at 3.2.
const ground = (_x: number, z: number) => (z < -34 && z > -79 ? -90 : z >= -34 ? 4.2 : 3.2);
type Box = Extract<Footprint, { kind: 'box' }>;
const boxes = (fs: Footprint[]) => fs.filter((f): f is Box => f.kind === 'box');

describe('a stone arch across a chasm (the gorge bridge, as long as the crossing)', () => {
  const a = stoneArch(0, -56, 52, 'z', ground, { steps: true });
  const deck = boxes(a.footprints).filter((f) => Math.abs(f.x) < 0.01 && f.top - f.bottom! < 1).sort((p, q) => q.z - p.z);
  const k = 52 / WITCH_BRIDGE.length;

  it('runs along z from rim to rim, the model scaled whole to the length', () => {
    const zs = deck.map((f) => f.z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(51);
    expect(Math.max(...zs)).toBeLessThan(-30);
    expect(Math.min(...zs)).toBeGreaterThan(-82);
    expect(a.scale).toBeCloseTo(k, 6);
    expect(deck[0].hw).toBeCloseTo(WITCH_BRIDGE.halfWidth * k, 6);
    expect(Math.abs(Math.sin(a.yaw))).toBeCloseTo(1, 6);
  });

  it('starts both ends at the higher bank and arches over the middle', () => {
    expect(deck[0].top - 4.2).toBeLessThan(0.3);
    expect(deck.at(-1)!.top - 4.2).toBeLessThan(0.3);
    expect(a.deckY - deck[0].top).toBeGreaterThan(0.5 * WITCH_BRIDGE.height * k);
  });

  it('has a deck with no step a walker would trip on', () => {
    for (let i = 1; i < deck.length; i++) expect(Math.abs(deck[i].top - deck[i - 1].top)).toBeLessThan(0.15);
  });

  it('climbs from the lower bank onto the deck by steps no higher than a stair', () => {
    const north = boxes(a.footprints).filter((f) => f.z < -82).sort((p, q) => q.z - p.z);
    expect(north.length).toBeGreaterThan(1);
    expect(north.at(-1)!.top - 3.2).toBeLessThan(0.4);
    expect(Math.abs(north[0].top - deck.at(-1)!.top)).toBeLessThan(0.15);
    for (let i = 1; i < north.length; i++) expect(north[i - 1].top - north[i].top).toBeLessThan(0.4);
    // (The south bank is level with the deck's end: no steps there.)
    expect(boxes(a.footprints).filter((f) => f.z > -30).length).toBe(0);
  });

  it('puts candles on its parapets the whole way over', () => {
    const zs = a.posts.map((p) => p.z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(40);
    for (const p of a.posts) expect(Math.abs(Math.abs(p.x) - (WITCH_BRIDGE.halfWidth * k + 0.2))).toBeLessThan(0.01);
  });
});

describe('a humpback footbridge sized to its crossing', () => {
  it('lands both ends on the banks and arches over the water between, at any length', async () => {
    const { witchBridgeDeck } = await import('./Walkways');
    const bank = 20;
    const d = witchBridgeDeck(822, 18, () => bank, 18);
    const deck = d.footprints.filter((f) => f.kind === 'box' && Math.abs(f.z - 18) < 0.01).map((f) => f as { x: number; top: number; hd: number });
    const xs = deck.map((f) => f.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(16.5);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(18);
    const ends = deck.filter((f) => Math.abs(f.x - 822) > 8.5);
    for (const e of ends) expect(Math.abs(e.top - bank)).toBeLessThan(0.45);
    expect(d.deckY - bank).toBeGreaterThan(1.2);
    expect(deck[0].hd).toBeCloseTo(2.3 * 18 / 22, 6);
  });
});

// The wooden arched footbridge of the eye (#28) at the chasm's and the gorge's lengths (the playtest of 2026-11-14:
// "put this kind of bridge in here as well, instead of that big wide bridge").
describe('a wooden arched footbridge across a chasm', () => {
  const TILE = 0.2;
  const a = woodArch(0, -56, 52, 'z', ground, TILE, { steps: true });
  const deck = boxes(a.footprints).filter((f) => Math.abs(f.x) < 0.01 && f.top - f.bottom! < 1).sort((p, q) => q.z - p.z);

  it('runs along z from rim to rim, narrow like the eye bridge', () => {
    const zs = deck.map((f) => f.z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(51);
    expect(Math.max(...zs)).toBeLessThan(-29);
    expect(Math.min(...zs)).toBeGreaterThan(-83);
    expect(deck[0].hw).toBeLessThan(1.6);
  });

  it('starts both ends at the higher bank and arches a few metres over the middle', () => {
    expect(Math.abs(deck[0].top - 4.3)).toBeLessThan(0.3);
    expect(Math.abs(deck.at(-1)!.top - 4.3)).toBeLessThan(0.3);
    expect(a.deckY - 4.3).toBeGreaterThan(3);
    expect(a.deckY - 4.3).toBeLessThan(8);
  });

  it('has a deck with no step a walker would trip on, and railings both sides', () => {
    for (let i = 1; i < deck.length; i++) expect(Math.abs(deck[i].top - deck[i - 1].top)).toBeLessThan(0.15);
    const rails = boxes(a.footprints).filter((f) => Math.abs(f.x) > 1 && Math.abs(f.x) < 2 && f.z < -31 && f.z > -81);
    expect(rails.filter((f) => f.x > 0).length).toBeGreaterThan(20);
    expect(rails.filter((f) => f.x < 0).length).toBeGreaterThan(20);
  });

  it('climbs from the lower bank onto the deck by steps no higher than a stair', () => {
    const north = boxes(a.footprints).filter((f) => f.z < -82).sort((p, q) => q.z - p.z);
    expect(north.length).toBeGreaterThan(1);
    expect(north.at(-1)!.top - 3.2).toBeLessThan(0.4);
    for (let i = 1; i < north.length; i++) expect(north[i - 1].top - north[i].top).toBeLessThan(0.4);
  });

  it('lays plank tiles end to end along the arch, pitched with it, and posts along both rails', () => {
    const zs = a.tiles.map((t) => t.z).sort((p, q) => p - q);
    expect(zs.at(-1)! - zs[0]).toBeGreaterThan(48);
    for (let i = 1; i < zs.length; i++) expect(zs[i] - zs[i - 1]).toBeLessThan(3.5);
    // Rising toward the crown from the south end (z -30, heading -z): nose up there, down past the middle.
    const south = a.tiles.find((t) => t.z > -40)!;
    const north = a.tiles.find((t) => t.z < -72)!;
    expect(Math.sign(south.pitch)).toBe(-Math.sign(north.pitch));
    expect(a.posts.length).toBeGreaterThan(20);
  });

  it('runs along x too (the gorge), its tiles turned to the span', () => {
    const g = woodArch(-65, -124, 28, 'x', (x) => (Math.abs(x + 65) < 13 ? -20 : 6), TILE);
    const xs = g.tiles.map((t) => t.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(24);
    for (const t of g.tiles) { expect(t.z).toBeCloseTo(-124, 6); expect(Math.abs(Math.sin(t.yaw))).toBeCloseTo(1, 6); }
  });
});
