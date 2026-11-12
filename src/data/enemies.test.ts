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
