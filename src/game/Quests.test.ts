import { describe, expect, it } from 'vitest';
import { Quests } from './Quests';

describe('Quests', () => {
  it('starts every quest at none and tracks only the ones in progress', () => {
    const q = new Quests();
    expect(q.stage('throne')).toBe('none');
    expect(q.tracker()).toEqual([]);
    q.set('throne', 'active');
    expect(q.tracker()).toEqual([{ title: 'The Usurped Throne', objective: 'Slay the Antlered Warden in the east forest' }]);
    q.set('throne', 'done');
    expect(q.tracker()).toEqual([]);
    expect(q.active('throne')).toBe(false);
  });

  it('moves the throne quest on when the Warden dies, and only then', () => {
    const q = new Quests();
    let changes = 0;
    q.onChange = () => changes++;
    q.kill('warden');
    expect(q.stage('throne')).toBe('none');
    q.set('throne', 'active');
    q.kill('yeti');
    expect(q.stage('throne')).toBe('active');
    q.kill('warden');
    expect(q.stage('throne')).toBe('slain');
    expect(changes).toBe(2);
  });
});
