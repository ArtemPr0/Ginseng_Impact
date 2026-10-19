import { Group, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { Npc } from '../world/NPCs';
import { Adventures, type AdventureDeps } from './Adventures';

// No GLB fetches in node: the sack's model stays unloaded.
vi.mock('../models/ModelRig', () => ({ loadModelOrWarn: () => Promise.resolve(null), ModelRig: class {} }));

/** A stand-in NPC at (x, z), talked to within `talkRange` metres (as main.ts measures it). */
function npc(id: string, x: number, z: number, talkRange = 4.2): Npc {
  return { def: { id, name: id }, pos: new Vector3(x, 0, z), yaw: 0, hidden: false, talkRange, object: new Group() } as unknown as Npc;
}

/** The hero at the origin, among `npcs` and doors (`range` 3 m) in their zones. */
function setup(npcs: Npc[], doors: Array<{ x: number; z: number; zone: string | null; label: string }> = []) {
  const seat = { root: new Group() };
  const world = {
    npcs,
    interactables: doors.map((d) => ({ pos: new Vector3(d.x, 0, d.z), range: 3, zone: d.zone, label: () => d.label, act: () => {} })),
    heights: { heightAt: () => 0 },
    seatOf: (id: string) => (id === 'croak' ? seat : undefined),
    moveNpcToZone: vi.fn(),
  };
  const quiet = () => {};
  const deps = {
    controller: { pos: new Vector3(0, 0, 0), yaw: 0, vel: new Vector3(), mode: 'ground', drainScale: 1 },
    world,
    hud: { announce: quiet, setQuests: quiet, setTimer: quiet },
    audio: { coins: quiet, loot: quiet, voice: () => Promise.resolve(0), slurp: quiet, cast: quiet, footstep: quiet },
    inventory: { shards: 0, add: quiet, has: () => false, remove: () => true },
    teleport: quiet,
    activeRig: () => ({ root: new Group() }),
    debuffs: () => [],
    fight: { spawnBoss: () => { throw new Error('no fight here'); }, despawn: quiet },
  } as unknown as AdventureDeps;
  return { a: new Adventures(deps), world, seat };
}

/** Croak into the sack the way the player does it: through his own conversation. */
function bag(a: Adventures): void {
  a.quests.set('croak', 'active');
  a.talk('croak')!.choices.find((c) => c.label === 'Put him in the bag')!.run!();
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
});
