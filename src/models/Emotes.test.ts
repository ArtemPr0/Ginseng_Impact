import { describe, expect, it } from 'vitest';
import { EMOTE_FILES, emotesFor } from './Emotes';

describe('emotesFor', () => {
  it('gives every Meshy biped (it walks with the shared Walking clip) the shared emotes', () => {
    expect(emotesFor({}, ['Running', 'Walking', 'Idle_02'])).toEqual(EMOTE_FILES);
  });

  it('gives nothing to a body without the biped walk (creatures, statics)', () => {
    expect(emotesFor({}, [])).toEqual({});
    expect(emotesFor({}, ['Swim', 'Bite'])).toEqual({});
  });

  it('never overrides a clip file the model already names, and can be turned off', () => {
    expect(emotesFor({ clipFiles: { cheer: 'own-cheer.glb' } }, ['Walking']).cheer).toBeUndefined();
    expect(emotesFor({ emotes: false }, ['Walking'])).toEqual({});
  });

  it('covers cheer, wave, dance, shrug and the rest', () => {
    expect(Object.keys(EMOTE_FILES).sort()).toEqual(['cheer', 'clap', 'dance', 'jacks', 'shrug', 'stomp', 'wave', 'ymca']);
  });
});

import { reactionFor } from './Emotes';

describe('reactionFor', () => {
  it('cheers or dances at a kill nearby, picked at random', () => {
    expect(['cheer', 'dance', 'ymca', 'jacks']).toContain(reactionFor('kill', false, () => 0)?.key);
    expect(['cheer', 'dance', 'ymca', 'jacks']).toContain(reactionFor('kill', false, () => 0.99)?.key);
  });

  it('claps from the seat instead (standing clips would lift a seated body off its chair)', () => {
    expect(reactionFor('kill', true, () => 0.5)?.key).toBe('clap');
    expect(reactionFor('wave', true, () => 0.5)).toBeNull();
  });

  it('dances the YMCA for a boss, shrugs at a wipe, waves hello', () => {
    expect(reactionFor('boss', false, () => 0)?.key).toBe('ymca');
    expect(reactionFor('wipe', false, () => 0)?.key).toBe('shrug');
    expect(reactionFor('wave', false, () => 0)?.key).toBe('wave');
  });

  it('lasts a few seconds', () => {
    for (const k of ['kill', 'boss', 'wipe', 'wave', 'levelup'] as const) {
      const r = reactionFor(k, false, () => 0.3);
      expect(r?.seconds).toBeGreaterThan(1.5);
      expect(r?.seconds).toBeLessThan(9);
    }
  });
});
