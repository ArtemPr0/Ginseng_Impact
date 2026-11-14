import { describe, expect, it } from 'vitest';
import { ENEMY_DEFS, ENEMY_SPAWNS } from './enemies';
import { MODELS } from './models';
import { GRAVE_CASTLE } from './world';

// The playtest of 2026-11-14: "add some witchcraft, necromancy, skeleton mobs on and around the mountain castle at the
// end of the Alley of Graves".
describe('the castle at the end of the Alley of Graves', () => {
  const near = (kind: string) => ENEMY_SPAWNS.filter((s) => s.kind === kind && Math.hypot(s.x - GRAVE_CASTLE.x, s.z - GRAVE_CASTLE.z) < 26);

  it('is held by necromancers who raise the risen dead and throw bolts', () => {
    expect(near('necromancer').length).toBeGreaterThanOrEqual(3);
    const d = ENEMY_DEFS.necromancer;
    expect(d.summons).toBe('grave-skeleton');
    expect(d.attacks?.map((a) => a.kind)).toEqual(expect.arrayContaining(['summon', 'volley']));
    expect(d.boss).toBeFalsy();
    expect(MODELS.necromancer.file).toBe(MODELS['archway-shade'].file); // the reel's hooded figure (DdnJDwBMUoj)
  });

  it('has witches hexing from its steps who never walk (their model has no rig: a walk only slid them along)', () => {
    expect(near('grave-witch').length).toBeGreaterThanOrEqual(2);
    const d = ENEMY_DEFS['grave-witch'];
    expect(d.speed).toBe(0);
    expect(d.attacks?.map((a) => a.kind)).toEqual(expect.arrayContaining(['roots']));
    expect(MODELS['grave-witch'].file).toBe(MODELS.witch.file);
  });

  it('has skeletons round its foot, and nobody wanders off it', () => {
    expect(near('grave-skeleton').length).toBeGreaterThanOrEqual(4);
    for (const k of ['necromancer', 'grave-witch'] as const) expect(ENEMY_DEFS[k].leash ?? 99).toBeLessThanOrEqual(16);
  });
});
