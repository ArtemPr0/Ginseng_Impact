/**
 * One height for the whole map: a sculpted realm where one reaches, otherwise the island's terrain (the abyss
 * included). HeightWorld, the minimap and anyone asking "what is under my feet" use this, so a realm's hills are
 * the ground and the old flat slabs are not.
 */
import type { RealmGrounds } from './RealmGround';

export class GroundQuery {
  constructor(
    private readonly terrain: { heightAt(x: number, z: number): number },
    private readonly realms: RealmGrounds,
  ) {}

  heightAt(x: number, z: number): number {
    return this.realms.heightAt(x, z) ?? this.terrain.heightAt(x, z);
  }
}
