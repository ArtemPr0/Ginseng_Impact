import { describe, expect, it } from 'vitest';
import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import { BlackHoleFx, FireTornadoFx, holeScale } from './VortexFx';

describe('holeScale: the black hole opens, holds, then collapses to a point', () => {
  it('tears open over 0.6 s, holds full size, shrinks to nothing in its last 0.35 s', () => {
    expect(holeScale(0, 4)).toBeLessThan(0.05);
    expect(holeScale(0.3, 4)).toBeGreaterThan(0.3);
    expect(holeScale(0.3, 4)).toBeLessThan(1);
    expect(holeScale(2, 4)).toBe(1);
    expect(holeScale(3.85, 4)).toBeLessThan(0.5);
    expect(holeScale(4, 4)).toBeLessThan(0.02);
  });
});

describe('BlackHoleFx', () => {
  it('is a black core with a photon ring, a tilted accretion disc and two polar jets; matter streaks fall into it', () => {
    const fx = new BlackHoleFx(0x8a3dff, 4);
    const names = fx.group.children.map((c) => c.name);
    for (const n of ['core', 'photon-ring', 'disc', 'disc2', 'jets', 'infall']) expect(names).toContain(n);
    const disc = fx.group.getObjectByName('disc')!;
    expect(Math.abs(disc.rotation.x)).toBeGreaterThan(1);
    fx.update(1, 0.016, new PerspectiveCamera());
    const infall = fx.group.getObjectByName('infall') as Mesh;
    expect(infall.geometry.drawRange.count).toBeGreaterThan(0);
  });

  it('every streak heads inward: its distance to the core shrinks frame to frame', () => {
    const fx = new BlackHoleFx(0x8a3dff, 4);
    const cam = new PerspectiveCamera();
    fx.update(1, 0.016, cam);
    const before = fx.streakRadii();
    fx.update(1.05, 0.05, cam);
    const after = fx.streakRadii();
    let inward = 0;
    for (let i = 0; i < before.length; i++) if (after[i] < before[i] || after[i] > 5) inward++;
    expect(inward / before.length).toBeGreaterThan(0.95);
  });

  it('dispose frees its geometry and materials', () => {
    const fx = new BlackHoleFx(0x8a3dff, 4);
    let freed = 0;
    fx.group.traverse((o) => { const m = o as Mesh; if (m.geometry) m.geometry.addEventListener('dispose', () => freed++); });
    fx.dispose();
    expect(freed).toBeGreaterThan(4);
  });
});

describe('FireTornadoFx', () => {
  it('is nested twisting fire shells, wide at the top and flared at the base, with a smoke cap', () => {
    const fx = new FireTornadoFx(0xff5a10);
    const shells = fx.group.children.filter((c) => c.name.startsWith('shell'));
    expect(shells.length).toBeGreaterThanOrEqual(3);
    expect(fx.group.getObjectByName('smoke')).toBeTruthy();
    // The profile: base flare, narrow just above the ground, wide at the top.
    const r = (y: number) => fx.radiusAt(y);
    expect(r(0)).toBeGreaterThan(r(0.8));
    expect(r(7)).toBeGreaterThan(r(0) * 1.5);
  });

  it('sways and leans as it moves (never a straight upright cone)', () => {
    const fx = new FireTornadoFx(0xff5a10);
    const tilts = new Set<number>();
    for (let t = 0; t < 3; t += 0.5) { fx.update(t, 0.016, new Vector3(1, 0, 0)); tilts.add(Math.round(fx.group.rotation.z * 100)); }
    expect(tilts.size).toBeGreaterThan(2);
  });
});
