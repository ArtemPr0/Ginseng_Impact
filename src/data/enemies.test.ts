import { describe, expect, it } from 'vitest';
import { ENEMY_DEFS, ORBIT_SHOT } from './enemies';

describe('Old Hollowstaff', () => {
  const d = ENEMY_DEFS['diamond-wizard'];
  it('has lean cups circling him, not diamonds', () => {
    expect(d.orbit).toEqual({ model: 'lean-cup', count: 9 });
    expect(d.title).not.toMatch(/diamond/i);
  });
  it('throws the cup nearest you as a cup (the thrown double cup, lean and all)', () => {
    expect(ORBIT_SHOT[d.orbit!.model]).toBe('cup');
  });
});

describe('the Sunken City\'s water boss (the playtest of 2026-11-13: "some sort of water boss near this building")', async () => {
  const { ENEMY_SPAWNS } = await import('./enemies');
  const { MODELS } = await import('./models');
  const { SUNKEN } = await import('./world');
  const { summonKind } = await import('../combat/summon');
  const church = { x: SUNKEN.x, z: -116 };
  const boss = ENEMY_SPAWNS.find((s) => ENEMY_DEFS[s.kind].boss && ENEMY_DEFS[s.kind].element === 'tide' && Math.hypot(s.x - church.x, s.z - church.z) < 25);

  it('swims round the drowned church', () => {
    expect(boss).toBeDefined();
    const d = ENEMY_DEFS[boss!.kind];
    expect(d.flying).toBe(true);
    expect(boss!.patrol?.length).toBeGreaterThan(2);
    for (const [x, z] of boss!.patrol!) expect(Math.hypot(x - church.x, z - church.z)).toBeLessThan(30);
    // Every leg keeps the 4.6 m fish clear of the church (its collider reaches ~9.7 m from the middle: the review).
    const P = boss!.patrol!;
    for (let i = 0; i < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length];
      for (let t = 0; t <= 1; t += 0.05) expect(Math.hypot(ax + (bx - ax) * t - church.x, az + (bz - az) * t - church.z), `leg ${i} at ${t}`).toBeGreaterThan(12.5);
    }
  });

  it('is a reel subject: the city\'s big blue grouper (DeVj-Z8POjl), grown huge', () => {
    const m = MODELS[boss!.kind];
    expect(m.file).toBe(MODELS['blue-fish'].file);
    expect(m.label).toMatch(/DeVj-Z8POjl/);
    expect(m.height).toBeGreaterThan(MODELS['blue-fish'].height * 3);
  });

  it('calls the city\'s anglers to help, not island beasts', () => {
    expect(summonKind(boss!.kind)).toBe('angler');
    expect(summonKind('lurker')).toBe('beast');
    expect(summonKind('rift-king')).toBe('styro-ghoul');
  });
});
