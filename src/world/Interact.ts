import type { Vector3 } from 'three';

/**
 * Something in the world the hero can use with F (a door, a boat): where it is, how close counts, what the prompt
 * says (null: nothing to do right now) and what F does. `zone` is the realm it lives in (null: the island).
 */
export interface Interactable {
  pos: Vector3;
  range: number;
  zone: string | null;
  label(): string | null;
  act(): void;
}

/** Moves the hero (main.ts): to (x, y, z) facing `yaw` (controller yaw), with an optional place name to announce. */
export type Teleport = (x: number, y: number, z: number, yaw: number, name?: string) => void;
