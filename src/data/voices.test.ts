import { describe, expect, it } from 'vitest';
import { VOICES, voiceUrl } from './voices';

/** The rendered lines under public/audio, by id (the glob's keys are the paths; nothing is loaded). */
const RENDERED = Object.keys(import.meta.glob('/public/audio/*.mp3')).map((p) => p.slice(p.lastIndexOf('/') + 1, -'.mp3'.length)).sort();

describe('voices', () => {
  it("the frog says how long his dream lasts: four minutes (Adventures' DREAM_SECONDS)", () => {
    expect(VOICES['frog-licked'].text).toContain('about four minutes');
  });

  it("Goldgrin's line is a managed voice, with its caption", () => {
    expect(VOICES['where-is-young-lean']?.text).toBe('Where is Young Lean?');
  });

  it('every line is rendered, and every rendered file is a line the voices script knows', () => {
    expect(RENDERED).toEqual(Object.keys(VOICES).sort());
  });

  it("every NPC's voice line is one the script renders, with the caption it was rendered from", async () => {
    const { NPC_DEFS } = await import('../world/NPCs');
    const byUrl = new Map(Object.entries(VOICES).map(([id, v]) => [voiceUrl(id), v.text]));
    for (const def of NPC_DEFS) {
      if (!def.voice) continue;
      expect(byUrl.get(def.voice.url), `${def.id}: ${def.voice.url}`).toBe(def.voice.caption);
    }
  });
});
