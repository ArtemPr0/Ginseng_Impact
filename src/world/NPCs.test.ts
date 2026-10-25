import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { MODELS } from '../data/models';
import { Npc, NPC_DEFS, type NpcDef } from './NPCs';

// A body that never loads a file: the bubble and the lines are what these tests are about.
vi.mock('../characters/Rig', () => ({ Rig: class { root = new Group(); model = null; holdCup(): void {} } }));

/** Enough of a canvas for a speech bubble to draw on; it remembers the text it was handed (a long line comes in two pieces). */
const drawn: string[] = [];
const ctx = {
  font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: '', textBaseline: '',
  clearRect() {}, measureText: (t: string) => ({ width: t.length * 14 }), fillRect() {}, strokeRect() {},
  beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, fillText(t: string) { drawn.push(t); },
};
/** The sprite's height in metres (SpeechBubble's scale). */
const SPRITE_H = 2.6 * (112 / 512);

const def = (id: string): NpcDef => NPC_DEFS.find((d) => d.id === id)!;
const make = (id: string): Npc => new Npc(def(id), { x: 0, z: 0 }, () => 0);
const bubbleOf = (n: Npc) => n.object.children.find((c) => c.type === 'Sprite')!;

beforeEach(() => {
  drawn.length = 0;
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});
afterEach(() => { vi.unstubAllGlobals(); Npc.sound = null; });

describe('Npc.speak', () => {
  it('an NPC without a recorded line shows his first written one in a bubble (the talk panel opens on that line too)', () => {
    const n = make('carriage-count');
    expect(bubbleOf(n)).toBeUndefined();
    n.speak();
    expect(drawn.join(' ')).toBe(def('carriage-count').lines[0]);
    expect(bubbleOf(n).visible).toBe(true);
  });

  it('or the written line asked for (the carriage offer picks one at random)', () => {
    const n = make('carriage-count');
    n.speak(1, 2);
    expect(drawn.join(' ')).toBe(def('carriage-count').lines[2]);
  });

  it('a voiced NPC says his recorded line on the npc channel, its caption in the bubble, whichever line is asked for', () => {
    const voice = vi.fn(async () => 1);
    Npc.sound = { voice, slurp() {} };
    const d = NPC_DEFS.find((x) => x.voice)!;
    const n = make(d.id);
    n.speak(0.5, 1);
    expect(voice).toHaveBeenCalledWith(d.voice!.url, 0.5, 'npc');
    expect(drawn.join(' ')).toBe(d.voice!.caption);
  });
});

describe('the bubble', () => {
  it('floats the model height + 0.55 m over the feet by default', () => {
    const n = make('king');
    n.speak();
    expect(bubbleOf(n).position.y).toBeCloseTo(MODELS.king.height + 0.55);
  });

  it("Count Rattlewheel's floats where his def says, clear of his carriage roof", () => {
    const d = def('carriage-count');
    expect(d.bubbleAbove).toBeDefined();
    // He sits 0.82 m up inside (Carriage.ts, INSIDE.up); the bubble's lower edge must ride over 0.4 m clear of the 3.2 m roof.
    expect(0.82 + d.bubbleAbove! - SPRITE_H / 2).toBeGreaterThanOrEqual(MODELS.carriage.height + 0.4);
    const n = make('carriage-count');
    n.speak();
    expect(bubbleOf(n).position.y).toBeCloseTo(d.bubbleAbove!);
  });
});
