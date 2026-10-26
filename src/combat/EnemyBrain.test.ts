import { describe, expect, it } from 'vitest';
import { AttackTokens, EnemyBrain } from './EnemyBrain';

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

describe('EnemyBrain: attack tokens (the injected canAttack)', () => {
  const DT = 1 / 60;

  it('stays in chase within reach while canAttack refuses, and winds up the step it allows', () => {
    const b = new EnemyBrain(melee);
    b.update(DT, 10);
    let allowed = false;
    for (let i = 0; i < 120; i++) expect(b.update(DT, 2, () => allowed)).toBe('chase');
    allowed = true;
    expect(b.update(DT, 2, () => allowed)).toBe('windup');
  });

  it('asks only when it could strike: in reach and cooled down', () => {
    const b = new EnemyBrain({ ...melee, attackCooldown: 0.5 });
    let asked = 0;
    const ask = () => { asked++; return true; };
    b.update(DT, 10, ask);
    for (let i = 0; i < 30; i++) b.update(DT, 6, ask); // chasing, out of reach
    expect(asked).toBe(0);
    expect(b.update(DT, 2, ask)).toBe('windup');
    expect(asked).toBe(1);
    // Through the wind-up, the blow and the recovery (and the cooldown after it) it does not ask again.
    let steps = 0;
    while (b.state !== 'chase' && steps++ < 600) b.update(DT, 2, ask);
    expect(asked).toBe(1);
    // Back in chase with 0.5 s of cooldown left over the 1 s recovery: none left, so it asks at once.
    b.update(DT, 2, ask);
    expect(asked).toBe(2);
  });

  it('three melee mobs share two tokens: two wind up, the third waits until a striker recovers', () => {
    const tokens = new AttackTokens<number>(2);
    const brains = [0, 1, 2].map(() => new EnemyBrain({ ...melee }));
    const striking = (id: number) => brains[id].state === 'windup' || brains[id].state === 'attack';
    const step = () => {
      brains.forEach((b, id) => b.update(DT, 2, () => tokens.take(id)));
      tokens.settle(striking);
    };
    brains.forEach((b) => b.update(DT, 10));
    step();
    expect(brains.map((b) => b.state)).toEqual(['windup', 'windup', 'chase']);
    expect(tokens.held).toBe(2);
    // Never more than two winding up or striking at once; the third waits for the first blow to be done.
    let third = -1;
    for (let i = 1; i < 240; i++) {
      step();
      expect([0, 1, 2].filter(striking).length).toBeLessThanOrEqual(2);
      if (third < 0 && brains[2].state === 'windup') third = i;
    }
    // The first two strike once the 0.6 s wind-up is up, recover (giving their tokens back), and the third goes next.
    const windupSteps = Math.round(melee.windup / DT);
    expect(third).toBeGreaterThanOrEqual(windupSteps);
    expect(third).toBeLessThanOrEqual(windupSteps + 3);
  });

  it('a dead or fled holder gives its token back', () => {
    const tokens = new AttackTokens<number>(1);
    const a = new EnemyBrain({ ...melee });
    const b = new EnemyBrain({ ...melee });
    a.update(DT, 10); b.update(DT, 10);
    a.update(DT, 2, () => tokens.take(1));
    b.update(DT, 2, () => tokens.take(2));
    expect([a.state, b.state]).toEqual(['windup', 'chase']);
    a.kill();
    tokens.settle((id) => (id === 1 ? a : b).state === 'windup' || (id === 1 ? a : b).state === 'attack');
    expect(b.update(DT, 2, () => tokens.take(2))).toBe('windup');
  });
});

describe('EnemyBrain.windupFill', () => {
  it('runs 0 → 1 over the wind-up the brain was set, the blow landing the step it gets there', () => {
    const b = new EnemyBrain({ ...melee, windup: 0.5 });
    b.update(1 / 60, 10);
    b.update(1 / 60, 2);
    expect(b.windupFill).toBe(0);
    let last = 0;
    let steps = 0;
    while (b.state === 'windup') {
      expect(b.windupFill).toBeGreaterThanOrEqual(last);
      last = b.windupFill;
      b.update(1 / 60, 2);
      steps++;
    }
    expect(b.state).toBe('attack');
    // 0.5 s at 60 steps a second (the summed steps fall a hair short of 0.5 after 30: the 31st lands it).
    expect(steps).toBeGreaterThanOrEqual(30);
    expect(steps).toBeLessThanOrEqual(31);
    expect(last).toBeGreaterThan(0.96);
    expect(b.windupFill).toBe(0);
  });
});
