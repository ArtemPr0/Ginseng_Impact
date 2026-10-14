import { describe, expect, it } from 'vitest';
import { EnemyBrain } from './EnemyBrain';

const melee = { aggroRange: 18, attackRange: 2.5, windup: 0.6, recover: 1.0, attackCooldown: 0 };

describe('EnemyBrain (melee)', () => {
  it('idles until the player is in aggro range, then chases', () => {
    const b = new EnemyBrain(melee);
    expect(b.update(1 / 60, 30)).toBe('idle');
    expect(b.update(1 / 60, 10)).toBe('chase');
  });

  it('winds up in range, strikes once after the windup, then recovers and chases again', () => {
    const b = new EnemyBrain(melee);
    b.update(1 / 60, 10);
    expect(b.update(1 / 60, 2)).toBe('windup');
    let strikes = 0;
    for (let i = 0; i < 40; i++) if (b.update(1 / 60, 2) === 'attack') strikes++;
    expect(strikes).toBe(1);
    expect(b.state).toBe('recover');
    for (let i = 0; i < 70; i++) b.update(1 / 60, 2);
    expect(['windup', 'chase']).toContain(b.state);
  });

  it('drops aggro when the player is far away', () => {
    const b = new EnemyBrain(melee);
    b.update(1 / 60, 10);
    for (let i = 0; i < 60; i++) b.update(1 / 60, 60);
    expect(b.state).toBe('idle');
  });
});
