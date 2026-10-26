import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BannerQueue, DamageNumbers, Hud, type HudActions, type NumberStyle } from './Hud';
import { Inventory } from '../items/Inventory';
import { ROSTER } from '../characters/roster';

// ---------- the banner queue (pure) ----------

/** A fake clock in whole milliseconds, like the HUD's: `after` schedules and hands back a cancel; `advance` fires what is due, in order. */
function rig() {
  let now = 0;
  let seq = 0;
  const due: Array<{ at: number; seq: number; fn: () => void }> = [];
  const log: string[] = [];
  const stamp = () => (now / 1000).toFixed(2);
  const q = new BannerQueue({
    show: (text) => { log.push(`${stamp()} show ${text}`); },
    hide: () => { log.push(`${stamp()} hide`); },
    after: (seconds, fn) => {
      const timer = { at: now + Math.round(seconds * 1000), seq: seq++, fn };
      due.push(timer);
      return () => { const i = due.indexOf(timer); if (i >= 0) due.splice(i, 1); };
    },
  });
  const advance = (seconds: number) => {
    const end = now + Math.round(seconds * 1000);
    for (;;) {
      due.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const next = due[0];
      if (!next || next.at > end) break;
      due.shift();
      now = next.at;
      next.fn();
    }
    now = end;
  };
  return { q, log, advance };
}

describe('BannerQueue', () => {
  it('keeps a lone banner up for its seconds (2.2 by default) and shows the next at once when the line is clear', () => {
    const { q, log, advance } = rig();
    q.push('Aboard · F talk · SPACE jump off');
    expect(log).toEqual(['0.00 show Aboard · F talk · SPACE jump off']);
    advance(2.19);
    expect(log).toHaveLength(1);
    advance(0.01);
    expect(log.at(-1)).toBe('2.20 hide');
    advance(3);
    q.push('Grabbed!', { seconds: 1 });
    expect(log.at(-1)).toBe('5.20 show Grabbed!');
    advance(1);
    expect(log.at(-1)).toBe('6.20 hide');
  });

  it('shows a banner pushed behind another once the current has had its 0.5 s, after a 0.2 s breath', () => {
    const { q, log, advance } = rig();
    q.push('+1500 Moon Shards');
    q.push('The Usurped Throne · complete');
    expect(log).toEqual(['0.00 show +1500 Moon Shards']);
    advance(0.49);
    expect(log).toHaveLength(1);
    advance(0.01);
    expect(log.at(-1)).toBe('0.50 hide');
    advance(0.19);
    expect(log.at(-1)).toBe('0.50 hide');
    advance(0.01);
    expect(log.at(-1)).toBe('0.70 show The Usurped Throne · complete');
    advance(2.2); // nothing waits behind it: it has its full seconds
    expect(log.at(-1)).toBe('2.90 hide');
  });

  it('lets a warning through 0.2 s after a banner that has had its 0.5 s (the glare fires 1.1 s after its warning)', () => {
    const { q, log, advance } = rig();
    q.push('Moonfall'); // a burst name, every Q press
    advance(1.1);
    q.push('The eye is gathering a glare · look away');
    expect(log.at(-1)).toBe('1.10 hide');
    advance(0.2);
    expect(log.at(-1)).toBe('1.30 show The eye is gathering a glare · look away');
    advance(2.2);
    expect(log.at(-1)).toBe('3.50 hide');
  });

  it('cuts the banner on screen short for a higher priority; equals keep arrival order; a lower one never hurries a higher', () => {
    const { q, log, advance } = rig();
    q.push('first');
    q.push('second');
    q.push('third');
    advance(0.1);
    q.push('urgent', { priority: 1 });
    expect(log.at(-1)).toBe('0.10 hide'); // cut short at once
    q.push('also urgent', { priority: 1 });
    advance(0.2);
    expect(log.at(-1)).toBe('0.30 show urgent');
    advance(0.5); // its equal waits behind it: it yields once it has had 0.5 s (the cut banner's timer must not fire first)
    expect(log.at(-1)).toBe('0.80 hide');
    advance(0.2);
    expect(log.at(-1)).toBe('1.00 show also urgent');
    advance(2.2); // only lower ones wait behind it: it keeps its full seconds
    expect(log.at(-1)).toBe('3.20 hide');
    advance(0.2);
    expect(log.at(-1)).toBe('3.40 show second');
    advance(0.7);
    expect(log.at(-1)).toBe('4.10 show third');
    advance(2.2);
    expect(log.at(-1)).toBe('6.30 hide');
    expect(log.filter((l) => l.includes(' show ')).map((l) => l.split(' show ')[1])).toEqual(['first', 'urgent', 'also urgent', 'second', 'third']);
  });

  it('never holds a banner past its own seconds, and a push during the breath waits for it', () => {
    const { q, log, advance } = rig();
    q.push('blink', { seconds: 0.3 });
    q.push('next');
    advance(0.3);
    expect(log.at(-1)).toBe('0.30 hide'); // 0.3 s is all it asked for
    advance(0.1);
    q.push('later'); // during the breath: waits its turn
    expect(log.at(-1)).toBe('0.30 hide');
    advance(0.1);
    expect(log.at(-1)).toBe('0.50 show next');
    advance(0.5);
    expect(log.at(-1)).toBe('1.00 hide');
    advance(0.2);
    expect(log.at(-1)).toBe('1.20 show later');
  });
});

describe('BannerQueue coalescing', () => {
  it('shows the same line pushed again and again in a row once (three webs in one volley)', () => {
    const { q, log, advance } = rig();
    q.push('Webbed!', { priority: 1 });
    q.push('Webbed!', { priority: 1 });
    advance(0.3);
    q.push('Webbed!', { priority: 1 });
    advance(5);
    expect(log).toEqual(['0.00 show Webbed!', '2.20 hide']);
  });

  it('merges a repeat into the same line still waiting, and keeps the higher priority of the two', () => {
    const { q, log, advance } = rig();
    q.push('Moonfall');
    q.push('Grabbed!');
    q.push('Grabbed!');
    advance(5);
    expect(log.filter((l) => l.includes(' show ')).map((l) => l.split(' show ')[1])).toEqual(['Moonfall', 'Grabbed!']);
    const b = rig();
    b.q.push('Moonfall');
    b.q.push('The eye is gathering a glare · look away');
    b.q.push('The eye is gathering a glare · look away', { priority: 1 });
    expect(b.log.at(-1)).toBe('0.00 hide'); // the repeat's priority cut the burst name short
    b.advance(0.2);
    expect(b.log.at(-1)).toBe('0.20 show The eye is gathering a glare · look away');
    b.advance(5);
    expect(b.log.filter((l) => l.includes(' show '))).toHaveLength(2);
  });

  it('shows a line again once another came between, or once it has gone', () => {
    const { q, log, advance } = rig();
    q.push('Grabbed!');
    q.push('Webbed!');
    q.push('Grabbed!');
    advance(3);
    expect(log.filter((l) => l.includes(' show ')).map((l) => l.split(' show ')[1])).toEqual(['Grabbed!', 'Webbed!', 'Grabbed!']);
    advance(5);
    q.push('Grabbed!');
    expect(log.at(-1)).toMatch(/show Grabbed!$/);
  });
});

// ---------- damage numbers (pure) ----------

/** A fake screen for DamageNumbers on the same kind of fake clock: what is up, with its text and style. */
function numbers() {
  let now = 0;
  let seq = 0;
  const due: Array<{ at: number; seq: number; fn: () => void }> = [];
  const up: Array<{ text: string; style: NumberStyle; color: number; bumps: number }> = [];
  const n = new DamageNumbers<{ text: string; style: NumberStyle; color: number; bumps: number }>({
    show: (text, color, style) => { const el = { text, style, color, bumps: 0 }; up.push(el); return el; },
    bump: (el, text) => { el.text = text; el.bumps++; },
    remove: (el) => { const i = up.indexOf(el); if (i >= 0) up.splice(i, 1); },
    after: (seconds, fn) => {
      const timer = { at: now + Math.round(seconds * 1000), seq: seq++, fn };
      due.push(timer);
      return () => { const i = due.indexOf(timer); if (i >= 0) due.splice(i, 1); };
    },
    now: () => now / 1000,
  });
  const advance = (seconds: number) => {
    const end = now + Math.round(seconds * 1000);
    for (;;) {
      due.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const next = due[0];
      if (!next || next.at > end) break;
      due.shift();
      now = next.at;
      next.fn();
    }
    now = end;
  };
  return { n, up, advance, texts: () => up.map((e) => e.text) };
}

describe('DamageNumbers', () => {
  it('merges hits on one target within 0.25 s into one number that sums them ("312 ×2"), and pops it again', () => {
    const { n, up, advance, texts } = numbers();
    n.push(150, 0xff2a2a, 0, 0, { target: 7 });
    advance(0.1);
    n.push(162, 0xff2a2a, 0, 0, { target: 7 });
    expect(texts()).toEqual(['312 ×2']);
    expect(up[0].bumps).toBe(1);
    advance(0.25); // within 0.25 s of the last hit: the run goes on
    n.push(88, 0xff2a2a, 0, 0, { target: 7 });
    expect(texts()).toEqual(['400 ×3']);
    advance(0.26);
    n.push(50, 0xff2a2a, 0, 0, { target: 7 });
    expect(texts()).toEqual(['400 ×3', '50']);
  });

  it('keeps targets apart, never merges a crit with a plain hit, words or untargeted numbers', () => {
    const { n, up, texts } = numbers();
    n.push(10, 0, 0, 0, { target: 1 });
    n.push(20, 0, 0, 0, { target: 2 });
    n.push(30, 0xdfe6ff, 0, 0, { target: 1, crit: true });
    n.push(40, 0xdfe6ff, 0, 0, { target: 1, crit: true });
    n.push('Eclipse', 0xff2a2a, 0, 0, { target: 1, big: true });
    n.push(5, 0, 0, 0);
    n.push(5, 0, 0, 0);
    expect(texts()).toEqual(['10', '20', '70 ×2', 'Eclipse', '5', '5']);
    expect(up.map((e) => e.style)).toEqual(['hit', 'hit', 'crit', 'big', 'hit', 'hit']);
  });

  it('shows at most three numbers per target: the oldest gives way', () => {
    const { n, advance, texts } = numbers();
    for (const v of [1, 2, 3, 4]) { n.push(v, 0, 0, 0, { target: 9 }); advance(0.3); }
    expect(texts()).toEqual(['3', '4']); // 1 and 2 timed out (at 0.65 s and 0.95 s)
    const b = numbers();
    for (const v of [1, 2, 3, 4]) { b.n.push(v, 0, 0, 0, { target: 9, crit: v % 2 === 0 }); }
    expect(b.texts()).toEqual(['2', '3', '4']);
  });

  it('takes a number down after its life (0.65 s, 0.9 s for a crit or a word), a merged one counting from its last hit', () => {
    const { n, advance, texts } = numbers();
    n.push(12, 0, 0, 0, { target: 3 });
    n.push(99, 0, 0, 0, { target: 4, crit: true });
    advance(0.2);
    n.push(12, 0, 0, 0, { target: 3 });
    advance(0.64); // 0.84 s: the merged number's life began again at 0.2 s
    expect(texts()).toEqual(['24 ×2', '99']);
    advance(0.01);
    expect(texts()).toEqual(['99']);
    advance(0.05);
    expect(texts()).toEqual([]);
  });
});

// ---------- the HUD on a stubbed DOM ----------

/** The least DOM the Hud needs on these paths: innerHTML, textContent, classList, style, querySelector(All). */
function stubEl() {
  const classes = new Set<string>();
  return {
    innerHTML: '',
    textContent: '',
    style: {} as Record<string, string>,
    classList: {
      add: (c: string) => { classes.add(c); },
      remove: (c: string) => { classes.delete(c); },
      toggle: (c: string, on?: boolean) => { if (on ?? !classes.has(c)) classes.add(c); else classes.delete(c); },
      contains: (c: string) => classes.has(c),
    },
    querySelectorAll: () => [] as never[],
    querySelector: () => null,
    remove() {},
  };
}
type StubEl = ReturnType<typeof stubEl>;

/** A root whose querySelector hands out one stub per selector, kept, so a test can read what the Hud wrote. */
function stubContainer() {
  const els = new Map<string, StubEl>();
  const querySelector = (sel: string): StubEl => {
    let e = els.get(sel);
    if (!e) { e = stubEl(); els.set(sel, e); }
    return e;
  };
  return { ...stubEl(), querySelector };
}

const actions: HudActions = {
  onBuy: () => false, onSell() {}, onHire: () => 'ok', onEquip: () => false, onUse: () => false, onDrop() {}, onClose() {},
};

describe('Hud satchel', () => {
  it('names the currency Moon Shards, the wielder by display name, and lets the knight take a sword but not a bow', () => {
    const root = stubContainer();
    const hud = new Hud(root as unknown as HTMLElement);
    const inv = new Inventory();
    inv.equip(inv.add('hunters-bow'), 'archer', 'bow');
    inv.add('mist-blade');
    inv.add('moonstring-bow');
    hud.bind(actions, inv);
    hud.setParty(ROSTER, 0); // Sir Aldric, the greatsword hand
    hud.inventoryPanel();
    const html = root.querySelector('#hud-dialog').innerHTML;
    expect(html).toContain('Moon Shards');
    expect(html).not.toContain('Diamonds');
    expect(html).toContain('equipped by Wren');
    expect(html).not.toContain('equipped by archer');
    expect(html).toContain('Sir Aldric wields a greatsword');
    const rows = html.split('<div class="row">');
    const blade = rows.find((r) => r.includes('Bittersweet Blade'))!;
    expect(blade).toContain('data-act="equip"');
    expect(blade).not.toContain('disabled');
    expect(blade).toContain('Equip on Sir Aldric');
    const bow = rows.find((r) => r.includes('Moonstring Bow'))!;
    expect(bow).toContain('disabled');
  });
});

describe('Hud banner', () => {
  beforeEach(() => { vi.useFakeTimers(); (globalThis as { window?: unknown }).window = globalThis; });
  afterEach(() => { vi.useRealTimers(); delete (globalThis as { window?: unknown }).window; });

  it('drives the banner element on window timers: the text, the show class, the 0.5 s yield and the 0.2 s breath', () => {
    const root = stubContainer();
    const hud = new Hud(root as unknown as HTMLElement);
    const banner = root.querySelector('#hud-banner');
    hud.announce('+1500 Moon Shards');
    hud.announce('The Usurped Throne · complete');
    expect(banner.textContent).toBe('+1500 Moon Shards');
    expect(banner.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(499);
    expect(banner.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(banner.classList.contains('show')).toBe(false);
    vi.advanceTimersByTime(199);
    expect(banner.classList.contains('show')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(banner.textContent).toBe('The Usurped Throne · complete');
    expect(banner.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(2199);
    expect(banner.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(banner.classList.contains('show')).toBe(false);
  });

  it('cuts the banner short for a higher priority and clears the timer it no longer needs', () => {
    const root = stubContainer();
    const hud = new Hud(root as unknown as HTMLElement);
    const banner = root.querySelector('#hud-banner');
    hud.announce('Moonfall');
    vi.advanceTimersByTime(100);
    hud.announce('Grabbed!', { priority: 1 });
    expect(banner.classList.contains('show')).toBe(false);
    vi.advanceTimersByTime(200);
    expect(banner.textContent).toBe('Grabbed!');
    expect(banner.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(2199); // the cut banner's own timers (due at 500 ms) must not take this one down
    expect(banner.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(banner.classList.contains('show')).toBe(false);
  });
});
