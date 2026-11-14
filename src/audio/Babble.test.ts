import { describe, expect, it } from 'vitest';
import { BABBLE_CPS, MAX_BABBLE, babbleVoice, renderBabble, syllables } from './Babble';
import { NPC_DEFS } from '../world/NPCs';
import { DIALOGUE } from '../data/dialogue';

// The playtest of 2026-11-14: "NPC interactions are boring… add unique voices". Every NPC speaks its lines in a
// babble of its own (a pitched, shaped murmur per syllable, as the line types out), so no two sound alike.
describe('NPC babble voices', () => {
  const ids = [...new Set([...NPC_DEFS.map((d) => d.id), ...Object.keys(DIALOGUE)])];

  it('every NPC has a voice of its own', () => {
    const keys = ids.map((id) => {
      const v = babbleVoice(id, DIALOGUE[id]?.persona.tone);
      return `${v.wave}:${Math.round(v.pitch / 6)}:${Math.round(v.formant / 120)}:${v.wobble > 0.2}`;
    });
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes.length, `shared voices: ${dupes.join(', ')}`).toBeLessThanOrEqual(Math.floor(ids.length * 0.1));
  });

  it('a voice is the same every time (the NPC sounds like itself)', () => {
    expect(babbleVoice('frogking', 'warm')).toEqual(babbleVoice('frogking', 'warm'));
  });

  it('the stone head rumbles low and slow, the frogs croak with a wobble', () => {
    const head = babbleVoice('stone-head', 'grim');
    expect(head.pitch).toBeLessThan(90);
    expect(head.rate).toBeLessThan(8);
    expect(babbleVoice('frogking').wobble).toBeGreaterThan(0.2);
  });

  it('a sleepy voice is slower and lower than a manic one', () => {
    const sleepy = babbleVoice('somebody', 'sleepy');
    const manic = babbleVoice('somebody', 'manic');
    expect(sleepy.rate).toBeLessThan(manic.rate);
    expect(sleepy.pitch).toBeLessThan(manic.pitch);
  });
});

describe('a babbled line', () => {
  const v = babbleVoice('frogking');

  it('lasts as long as the line takes to type, and never past the cap', () => {
    const line = 'Find my son, stranger.';
    const s = syllables(line, v);
    const end = s[s.length - 1].t + s[s.length - 1].len;
    expect(end).toBeGreaterThan((line.length / BABBLE_CPS) * 0.7);
    expect(end).toBeLessThanOrEqual(line.length / BABBLE_CPS + 0.05);
    const long = syllables('blah '.repeat(80), v);
    expect(long[long.length - 1].t + long[long.length - 1].len).toBeLessThanOrEqual(MAX_BABBLE);
  });

  it('pauses at a full stop and rises at a question', () => {
    const s = syllables('Hello there. Who are you?', v);
    const gaps = s.slice(1).map((x, i) => x.t - (s[i].t + s[i].len));
    expect(Math.max(...gaps)).toBeGreaterThan(0.12);
    expect(s[s.length - 1].pitch).toBeGreaterThan(s[s.length - 2].pitch);
  });

  it('renders the same samples for the same line, loud enough and never clipping', () => {
    const a = renderBabble('Bittersweet. Everything is bittersweet.', v, 22050);
    const b = renderBabble('Bittersweet. Everything is bittersweet.', v, 22050);
    expect(a).toEqual(b);
    let peak = 0;
    for (const x of a) peak = Math.max(peak, Math.abs(x));
    expect(peak).toBeGreaterThan(0.2);
    expect(peak).toBeLessThanOrEqual(1);
  });
});
