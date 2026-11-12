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
