import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { SpellHost } from './SpellCast';
import { createControllerState } from '../player/CharacterController';
import { DebrisSim } from '../world/Debris';

/** A host where everything is a no-op that records what it was asked. */
export function fakeHost(over: Partial<SpellHost> = {}) {
  const log: string[] = [];
  const noop = new Proxy({}, { get: (_t, k) => (...a: unknown[]) => { log.push(String(k)); void a; } });
  const scene = new Group();
  const sim = new DebrisSim(() => 0);
  // The wall's rock (the spikes' model, pinnacle until spiky-rock is made) stands in as a 2.6 x 1.2 x 0.5 m box.
  const wallModel = new Group();
  const wm = new Mesh(new BoxGeometry(2.6, 1.2, 0.5, 8, 4, 2), new MeshStandardMaterial());
  wm.position.y = 0.6;
  wallModel.add(wm);
  const host: SpellHost = {
    model: (id) => (id === 'pinnacle' ? wallModel : null),
    enemies: [], controller: createControllerState({ x: 0, y: 0, z: 0 }),
    fx: noop as SpellHost['fx'], audio: noop as SpellHost['audio'], scene,
    element: () => 'fire' as never,
    hit: () => log.push('hit'), reachable: () => true,
    smash: () => log.push('smash'), dig: () => log.push('dig'), shake: () => {},
    heightAt: () => 0, debris: () => [sim], bloodMoon: () => {}, announce: () => {},
    ...over,
  };
  return { host, log, scene, sim };
}

