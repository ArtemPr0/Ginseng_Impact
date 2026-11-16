/**
 * Dresses an item on the ground as itself (ItemLooks): a small copy of its model, recoloured and lit from inside just
 * enough to read at night, its middle at the pickup's glow (a weapon leans and glows its own colour, as loot does); or
 * its drawn icon in its own colour (render/LootIcons) until its own model is made. LootField calls it for every item.
 */
import { Box3, Color, Group, Sprite, SpriteMaterial, Vector3 } from 'three';
import { ITEMS } from '../items/Items';
import { ITEM_LOOKS, itemGlow } from '../items/ItemLooks';
import { loadModel, ModelRig } from '../models/ModelRig';
import { lootIconTexture } from '../render/LootIcons';
import { harvestLook } from '../render/HarvestLooks';
import { litWood } from './Enemy';

/** Height of the middle of an item above its pickup's origin (where the glow sits). */
const MID = 0.5;
/** A dropped weapon leans this far off upright (a thin blade stood straight read as one dark line). */
const WEAPON_LEAN = 0.75;
const _c = new Color();
const _box = new Box3();
const _size = new Vector3();
const _mid = new Vector3();

export function dressLoot(object: Group, itemId: string): void {
  const look = ITEM_LOOKS[itemId];
  if (!look) return;
  if ('make' in look) {
    const piece = harvestLook(look.make);
    piece.position.y = MID;
    object.add(piece);
    return;
  }
  if ('icon' in look) {
    const icon = new Sprite(new SpriteMaterial({ map: lootIconTexture(look.icon), color: look.tint, transparent: true, alphaTest: 0.05, depthWrite: false }));
    icon.scale.setScalar(0.62);
    icon.position.y = MID;
    object.add(icon);
    return;
  }
  const weapon = ITEMS[itemId]?.kind === 'weapon';
  void loadModel(look.model).then((g) => {
    // (Taken or gone before its model arrived: nothing to dress.)
    if (!g || !object.parent) return;
    const rig = new ModelRig(look.model, g, { cloneMaterials: true });
    // A weapon (or a `shine` look) glows its own colour all over (dark steel lit through its own dark map stayed dark);
    // the rest are lit through their texture just enough to read.
    const shine = look.shine ?? (weapon ? 0.5 : 0);
    if (shine > 0) {
      for (const m of rig.materials) { m.emissiveMap = null; m.emissive.set(itemGlow(itemId)); m.emissiveIntensity = shine; m.needsUpdate = true; }
    } else litWood(rig.materials, 0.3, itemGlow(itemId));
    if (look.tint !== undefined) for (const m of rig.materials) m.color.multiply(_c.set(look.tint));
    // Sized by its longest side (a book sized by its height came out a metre wide) and centred on its middle.
    rig.root.updateMatrixWorld(true);
    _box.setFromObject(rig.root).getSize(_size);
    _box.getCenter(_mid);
    const k = look.size / Math.max(_size.x, _size.y, _size.z, 0.001);
    rig.root.scale.setScalar(k);
    rig.root.position.set(-_mid.x * k, -_mid.y * k, -_mid.z * k);
    const holder = new Group();
    holder.position.y = MID;
    if (weapon) holder.rotation.z = WEAPON_LEAN;
    holder.add(rig.root);
    object.add(holder);
  });
}
