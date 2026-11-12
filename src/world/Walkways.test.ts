import { describe, expect, it } from 'vitest';
import { causewayPostPoints, causewayWalk, SPAN_LENGTH } from './Walkways';
import type { CausewayConfig } from './Landmarks';

// A chasm between two banks at 3.2 m, like the island's (rims at z -34 and -79, the cloud sea at -90 below).
const ground = (_x: number, z: number) => (z < -34 && z > -79 ? -90 : 3.2);
const cfg: CausewayConfig = { x: 0, zStart: -30, zEnd: -82, width: 6, yStart: 3.45, yEnd: 3.45 };
const SPAN_H = 1.89;

describe('the causeway is one bridge, bank to bank', () => {
  const b = causewayWalk(cfg, ground, SPAN_H);

  it('lays its arched spans end to end: no copy overlaps the next', () => {
    const spans = [...b.spans].sort((a, c) => c.z - a.z);
    expect(spans.length).toBe(Math.round(52 / SPAN_LENGTH));
    for (let i = 1; i < spans.length; i++) {
      const gap = spans[i - 1].z - spans[i].z;
      expect(gap).toBeCloseTo(SPAN_LENGTH * spans[i].scale, 6);
    }
    // The first and last span end exactly at the bridge's ends.
    expect(spans[0].z + (SPAN_LENGTH * spans[0].scale) / 2).toBeCloseTo(cfg.zStart, 6);
    expect(spans.at(-1)!.z - (SPAN_LENGTH * spans.at(-1)!.scale) / 2).toBeCloseTo(cfg.zEnd, 6);
  });

  it('walks straight on from the ground at both ends: no stairs, no ledge', () => {
    expect('stairs' in b).toBe(false);
    const boxes = b.landmark.footprints.filter((f) => f.kind === 'box' && Math.abs(f.x - cfg.x) < 0.01);
    const tops = boxes.map((f) => (f as { z: number; top: number }));
    const south = tops.reduce((a, c) => (c.z > a.z ? c : a));
    const north = tops.reduce((a, c) => (c.z < a.z ? c : a));
    expect(south.top - ground(0, cfg.zStart)).toBeLessThan(0.4);
    expect(north.top - ground(0, cfg.zEnd)).toBeLessThan(0.4);
  });

  it('has a deck with no step a walker would trip on', () => {
    const deck = b.landmark.footprints.filter((f) => f.kind === 'box' && Math.abs(f.x - cfg.x) < 0.01).map((f) => f as { z: number; top: number }).sort((a, c) => c.z - a.z);
    for (let i = 1; i < deck.length; i++) expect(Math.abs(deck[i].top - deck[i - 1].top)).toBeLessThan(0.15);
  });

  it('stands on piers only over the chasm, one at every joint there, all alike', () => {
    for (const p of b.piers) expect(ground(p.x, p.z)).toBeLessThan(-50);
    const joints = b.spans.map((s) => s.z - (SPAN_LENGTH * s.scale) / 2).filter((z) => z > cfg.zEnd + 0.1 && ground(0, z) < -50);
    expect(b.piers.length).toBe(joints.length);
  });

  it('puts the lanterns on its own edge stones, one pair a span', () => {
    const posts = causewayPostPoints(cfg, SPAN_H);
    expect(posts.length).toBe(b.spans.length * 2);
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
