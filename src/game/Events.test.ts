import { describe, expect, it, vi } from 'vitest';
import { Events } from './Events';

describe('Events', () => {
  it('delivers to kind listeners and any-listeners, and unsubscribes', () => {
    const ev = new Events();
    const kills: string[] = [];
    const all: string[] = [];
    const off = ev.on('kill', (e) => kills.push(e.enemy));
    ev.onAny((e) => all.push(e.kind));
    ev.emit({ kind: 'kill', enemy: 'beast', boss: false, at: { x: 0, y: 0, z: 0 } });
    ev.emit({ kind: 'wipe' });
    off();
    ev.emit({ kind: 'kill', enemy: 'yeti', boss: true, at: { x: 0, y: 0, z: 0 } });
    expect(kills).toEqual(['beast']);
    expect(all).toEqual(['kill', 'wipe', 'kill']);
  });

  it('keeps delivering when a listener throws', () => {
    const ev = new Events();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const seen: number[] = [];
    ev.on('hurt', () => { throw new Error('boom'); });
    ev.on('hurt', (e) => seen.push(e.amount));
    ev.emit({ kind: 'hurt', amount: 12, by: 'beast' });
    expect(seen).toEqual([12]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
