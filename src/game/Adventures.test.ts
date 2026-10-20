import { Group, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ENEMY_DEFS } from '../data/enemies';
import { VOICES } from '../data/voices';
import type { Npc } from '../world/NPCs';
import { Adventures, type AdventureDeps } from './Adventures';
import type { DialogueNode } from './Dialogue';
import { Events } from './Events';
import type { Story } from './Story';

// No GLB fetches in node: the sack's model stays unloaded.
vi.mock('../models/ModelRig', () => ({ loadModelOrWarn: () => Promise.resolve(null), ModelRig: class {} }));

/** A stand-in NPC at (x, z), talked to within `talkRange` metres (as main.ts measures it). */
function npc(id: string, x: number, z: number, talkRange = 4.2): Npc {
  return { def: { id, name: id }, pos: new Vector3(x, 0, z), yaw: 0, hidden: false, talkRange, object: new Group() } as unknown as Npc;
}

/** Yung Lean off his throne, as the fight hands him back: alive until the test says otherwise. */
interface FakeBoss { alive: boolean; returning: boolean }

/** The hero at the origin, among `npcs` and doors (`range` 3 m) in their zones. */
function setup(npcs: Npc[], doors: Array<{ x: number; z: number; zone: string | null; label: string }> = [], events?: Events) {
  const seat = { root: new Group() };
  const world = {
    npcs,
    interactables: doors.map((d) => ({ pos: new Vector3(d.x, 0, d.z), range: 3, zone: d.zone, label: () => d.label, act: () => {} })),
    heights: { heightAt: () => 0 },
    seatOf: (id: string) => (id === 'croak' ? seat : undefined),
    moveNpcToZone: vi.fn(),
  };
  const quiet = () => {};
  const bag: string[] = [];
  const inventory = {
    shards: 0,
    add: (id: string) => { bag.push(id); },
    has: (id: string) => bag.includes(id),
    remove: (id: string) => { const i = bag.indexOf(id); if (i >= 0) bag.splice(i, 1); return i >= 0; },
    spend: (n: number) => { if (inventory.shards < n) return false; inventory.shards -= n; return true; },
  };
  const boss: FakeBoss = { alive: true, returning: false };
  const fight = { spawnBoss: vi.fn(() => boss), despawn: vi.fn() };
  const deps = {
    controller: { pos: new Vector3(0, 0, 0), yaw: 0, vel: new Vector3(), mode: 'ground', drainScale: 1 },
    world,
    hud: { announce: quiet, setQuests: quiet, setTimer: quiet },
    audio: { coins: quiet, loot: quiet, voice: () => Promise.resolve(0), slurp: quiet, cast: quiet, footstep: quiet },
    inventory,
    teleport: quiet,
    activeRig: () => ({ root: new Group() }),
    debuffs: () => [],
    fight,
    events,
  } as unknown as AdventureDeps;
  return { a: new Adventures(deps), world, seat, inventory, bag, boss, fight };
}

/** Croak into the sack the way the books do it: Brother Croak's 'In you go.' runs the dialogue world's bag-croak. */
function bag(a: Adventures): void {
  a.quests.step('croak', 'active', a.wallet);
  a.dw.bagCroak();
  expect(a.quests.stage('croak')).toBe('bagged');
}

const FAR_KING = npc('frogking', -54, -26);

describe('F with Croak in the sack', () => {
  it('lets a door in reach win over putting the sack down', () => {
    const { a } = setup([npc('croak', 50, 50), FAR_KING], [{ x: 1, z: 0, zone: null, label: 'Open the door' }]);
    bag(a);
    expect(a.interact(null)?.label).toBe('Open the door');
  });

  it('gives way to someone in talking range (main.ts then offers the talk)', () => {
    const { a } = setup([npc('croak', 50, 50), FAR_KING, npc('brother', 2, 0)]);
    bag(a);
    expect(a.interact(null)).toBeNull();
  });

  it('puts the sack down where nothing else is in reach', () => {
    const { a } = setup([npc('croak', 50, 50), FAR_KING, npc('brother', 20, 0)], [{ x: 1, z: 0, zone: 'galaxy', label: 'Open the door' }]);
    bag(a);
    expect(a.interact(null)?.label).toBe('Put the sack down');
  });

  it('puts the sack down by the Frog King whatever else is near', () => {
    const { a } = setup([npc('croak', 50, 50), npc('frogking', 6, 0), npc('brother', 2, 0)], [{ x: 1, z: 0, zone: null, label: 'Open the door' }]);
    bag(a);
    expect(a.interact(null)?.label).toBe('Put the sack down');
  });
});

describe('Croak out of the sack', () => {
  it('hides his seat while he is carried and sits him on it in the zone he is put down in', () => {
    const croak = npc('croak', 50, 50);
    const { a, world, seat } = setup([croak, FAR_KING]);
    bag(a);
    expect(croak.hidden).toBe(true);
    expect(seat.root.visible).toBe(false);
    a.interact('galaxy')!.act();
    expect(a.quests.stage('croak')).toBe('active');
    expect(croak.hidden).toBe(false);
    expect(seat.root.visible).toBe(true);
    expect(world.moveNpcToZone).toHaveBeenCalledWith(croak, 'galaxy');
  });

  it('is home when the sack goes down by his father', () => {
    const croak = npc('croak', 50, 50);
    const { a } = setup([croak, npc('frogking', 6, 0)]);
    bag(a);
    a.interact(null)!.act();
    expect(a.quests.stage('croak')).toBe('returned');
  });

  it('bags nobody unless his father has asked (the graph\'s step from active only)', () => {
    const croak = npc('croak', 50, 50);
    const { a, seat } = setup([croak, FAR_KING]);
    a.dw.bagCroak();
    expect(a.quests.stage('croak')).toBe('none');
    expect(croak.hidden).toBe(false);
    expect(seat.root.visible).toBe(true);
  });
});

describe('The quests the adventures move', () => {
  it('wakes from the dream into trip done, and never takes the slain god back', () => {
    const { a } = setup([]);
    a.dw.lick();
    expect(a.dreamLeft).toBeGreaterThan(0);
    a.wake();
    expect(a.quests.stage('trip')).toBe('done');
    a.quests.kill('dmt-entity');
    expect(a.quests.stage('trip')).toBe('god');
    a.wake();
    expect(a.quests.stage('trip')).toBe('god');
  });

  it('pays the Frog God\'s eye into the bag once (the graph gives it; he no longer drops it)', () => {
    const { a, bag: items } = setup([]);
    a.quests.kill('dmt-entity');
    a.quests.kill('dmt-entity');
    expect(items).toEqual(['third-eye']);
    expect(ENEMY_DEFS['dmt-entity'].drops?.map((d) => d.itemId)).not.toContain('third-eye');
  });

  it('picks the lost sound up into the bag, moving the quest and telling the bus', () => {
    const events = new Events();
    const loot: string[] = [];
    events.on('loot', (e) => loot.push(e.item));
    const { a, bag: items } = setup([], [], events);
    a.foundSound();
    expect(items).toEqual([]); // not before Yung Lean asked
    a.quests.step('sound', 'active', a.wallet);
    a.foundSound();
    expect(a.quests.stage('sound')).toBe('found');
    expect(items).toEqual(['mist-blade', 'lost-sound']);
    expect(loot).toEqual(['lost-sound']);
  });

  it("pays Yung Lean's purse once, whether his death or the fight's end comes first", () => {
    const { a, inventory, boss, fight } = setup([npc('yunglean', 1000, -74)]);
    a.dw.challengeKing();
    expect(fight.spawnBoss).toHaveBeenCalledTimes(1);
    boss.alive = false;
    a.quests.kill('rift-king'); // his death: the graph's 'crown' trigger pays
    expect(inventory.shards).toBe(600);
    a.update(3); // the fight ends: the same step again, for nothing
    expect(fight.despawn).toHaveBeenCalledTimes(1);
    expect(a.quests.stage('crown')).toBe('done');
    expect(inventory.shards).toBe(600);
    // A second win pays nothing.
    boss.alive = true;
    a.dw.challengeKing();
    boss.alive = false;
    a.quests.kill('rift-king');
    a.update(3);
    expect(inventory.shards).toBe(600);
  });

  it('pays the purse at the fight\'s end when nobody told the quests of his death', () => {
    const { a, inventory, boss } = setup([npc('yunglean', 1000, -74)]);
    a.dw.challengeKing();
    boss.alive = false;
    a.update(3);
    expect(a.quests.stage('crown')).toBe('done');
    expect(inventory.shards).toBe(600);
  });
});

describe('Talking', () => {
  it('talks through the Story once one is attached, and only to the rowers without one', () => {
    const { a } = setup([]);
    expect(a.talk('king')).toBeNull();
    expect(a.talk('rowers')?.line).toBe(VOICES['rower-offer'].text);
    const node: DialogueNode = { line: 'Kneel or do not.', choices: [] };
    const open = vi.fn((id: string) => (id === 'king' ? node : null));
    a.story = { open } as unknown as Story;
    expect(a.talk('king')).toBe(node);
    expect(open).toHaveBeenCalledWith('king');
  });
});

describe('What the adventures announce', () => {
  it('puts the lick, the rowers\' ale and every quest step on the bus', () => {
    const events = new Events();
    const feats: string[] = [];
    const steps: string[] = [];
    events.on('feat', (e) => feats.push(e.what));
    events.on('quest', (e) => steps.push(`${e.id}:${e.stage}`));
    const { a } = setup([npc('frogking', 2, 0)], [], events);
    a.dw.lick();
    a.wake();
    a.talk('rowers')!.choices.find((c) => c.label === 'Hell yeah!')!.run!();
    expect(feats).toEqual(['lick', 'ale']);
    expect(steps).toEqual(['trip:done']);
    expect(a.aleLeft).toBeGreaterThan(0);
  });

  it('stays quiet without a bus', () => {
    const { a } = setup([npc('frogking', 2, 0)]);
    expect(() => a.talk('rowers')!.choices.find((c) => c.label === 'Hell yeah!')!.run!()).not.toThrow();
    expect(() => { a.dw.lick(); a.wake(); }).not.toThrow();
    expect(a.aleLeft).toBeGreaterThan(0);
  });
});
