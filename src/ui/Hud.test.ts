import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BannerQueue, Hud, type HudActions } from './Hud';
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
