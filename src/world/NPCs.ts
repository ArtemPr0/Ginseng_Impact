import { Group, Vector3 } from 'three';
import { Rig, type RigPose } from '../characters/Rig';
import type { CharacterDef } from '../characters/roster';
import { PALETTE } from '../render/palette';

export type NpcBehaviour =
  | { kind: 'stand'; pose?: RigPose['pose']; yaw: number }
  | { kind: 'loop'; path: Array<[number, number]>; speed: number; pose?: RigPose['pose'] }
  | { kind: 'wander'; x: number; z: number; radius: number; speed: number };

export interface ShopEntry { itemId: string; price: number }

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  look: CharacterDef['look'];
  weapon: CharacterDef['weapon'];
  lines: string[];
  behaviour: NpcBehaviour;
  /** Items for sale (buy) — the NPC also buys any material. */
  shop?: ShopEntry[];
  /** Hire as a companion for this many shards. */
  hire?: { cost: number; atk: number; maxHp: number; ranged: boolean };
  /** Scale multiplier applied to the rig (ogres, trolls). */
  scale?: number;
  /** Extra prop attached to the chest. */
  prop?: 'logs' | 'lantern' | 'rod' | 'mug' | 'telescope' | 'book' | 'banner' | 'rose' | 'spoon' | 'greatsword';
}

const knightLook: CharacterDef['look'] = { cloth: 0x1a1d3c, armour: 0x2a3160, skin: 0x8c93b8, accent: PALETTE.electric, bulk: 1.15, height: 1.9 };

export const NPC_DEFS: NpcDef[] = [
  {
    id: 'king', name: 'The Antlered King', title: 'Who Buys What the Fog Drops', weapon: 'sword',
    look: { cloth: 0x7a1020, armour: 0x4a0c18, skin: 0x3f7a4a, accent: PALETTE.witch, antlers: true, bulk: 1.15, height: 1.95 },
    lines: ['Kneel or do not. The candles do not care.', 'Bring me what the great ones drop. I pay in shards and in silence.', 'My crown was antlers before it was gold. Everything here was something else first.'],
    behaviour: { kind: 'stand', pose: 'throne', yaw: -Math.PI / 2 },
    shop: [{ itemId: 'crown-blade', price: 900 }, { itemId: 'moon-dew', price: 30 }, { itemId: 'star-chart', price: 220 }],
  },
  {
    id: 'sentry', name: 'Sir Halvard', title: 'Knight of the Lonely Cliff', weapon: 'greatsword',
    look: { cloth: 0x14183a, armour: 0x1e2246, skin: 0x8c93b8, accent: PALETTE.blood, cape: true, bulk: 1.2, height: 1.95 },
    lines: ['Those windows have been lit for a hundred years. No one has come out.', 'I sit. I watch. For three hundred shards I will stand.', 'The pass below is the beast\'s. Go around, or go with me.'],
    behaviour: { kind: 'stand', pose: 'sitSword', yaw: Math.PI * 0.6 },
    hire: { cost: 300, atk: 95, maxHp: 2200, ranged: false },
    prop: 'greatsword',
  },
  {
    id: 'standard', name: 'Hollow Jack', title: 'Standard-Bearer of No Army', weapon: 'staff',
    look: { cloth: 0x0a0d2a, armour: 0x14183a, skin: 0x1a1a2a, accent: PALETTE.rune, skeleton: true, bulk: 0.72, height: 1.85 },
    lines: ['The banner is for a kingdom that lost. I kept the banner.', 'Wind up here never stops. Neither does the aurora. Neither do I.'],
    behaviour: { kind: 'stand', pose: 'banner', yaw: Math.PI * 0.25 },
    prop: 'banner',
  },
  {
    id: 'bride', name: 'The Pale Bride', title: 'Who Walks to the Sea', weapon: 'staff',
    look: { cloth: 0xdfe6ff, armour: 0xc9d2f5, skin: 0xe8ecff, accent: PALETTE.moon, cape: true, bulk: 0.8, height: 1.8 },
    lines: ['He said he would meet me where the sand ends.', 'The sand does not end. I keep walking.', '...do you hear the bells?'],
    behaviour: { kind: 'loop', path: [[56, 96], [74, 108], [90, 100], [74, 108]], speed: 0.9 },
  },
  {
    id: 'rose-knight', name: 'Sir Corvin', title: 'Who Brought a Rose', weapon: 'sword',
    look: { cloth: 0x05060f, armour: 0x0a0d2a, skin: 0x05060f, accent: PALETTE.blood, bulk: 1.2, height: 1.95 },
    lines: ['Do not speak loudly. She has not said yes yet.', 'A rose from the Last Garden. Red ones are rare here.'],
    behaviour: { kind: 'stand', pose: 'offer', yaw: Math.PI },
    prop: 'rose',
  },
  {
    id: 'maiden', name: 'Elowen', title: 'Of the Flower Garden', weapon: 'staff',
    look: { cloth: 0x3f7cff, armour: 0x5a8cff, skin: 0xf0e0d8, accent: PALETTE.electric, bulk: 0.78, height: 1.68 },
    lines: ['He walked through the fog for this. I am deciding.', 'The blue ones mean waiting. The red ones mean now.'],
    behaviour: { kind: 'stand', pose: 'bow', yaw: 0 },
  },
  {
    id: 'wanderer', name: 'The Lanternbearer', title: 'Who Has Seen the Burning Shore', weapon: 'staff',
    look: { cloth: 0x0a0a1a, armour: 0x14183a, skin: 0x05060f, accent: 0xff7a2a, cape: true, bulk: 0.9, height: 1.85 },
    lines: ['Across the water a castle burns and never falls. I stopped asking why.', 'Follow the lantern if you like. It only ever leads to the edge.'],
    behaviour: { kind: 'loop', path: [[-48, -40], [-10, -52], [30, -66], [-10, -52]], speed: 1.1, pose: 'lantern' },
    prop: 'lantern',
  },
  {
    id: 'watcher-knight', name: 'Dunmar', title: 'Who Watches the Sky', weapon: 'sword',
    look: { cloth: 0x05060f, armour: 0x0a0d2a, skin: 0x05060f, accent: PALETTE.electric, cape: true, bulk: 1.15, height: 1.9 },
    lines: ['It came out of the storm with a face. We have not moved since.', 'If it blinks, run.'],
    behaviour: { kind: 'stand', pose: 'watch', yaw: -Math.PI / 2 },
  },
  {
    id: 'watcher-mage', name: 'Sel', title: 'Who Watches the Sky', weapon: 'staff',
    look: { cloth: 0x2f63ff, armour: 0x4f7cff, skin: 0xb9c0e0, accent: PALETTE.rune, cape: true, hat: true, hatColor: 0x2f63ff, bulk: 0.8, height: 1.75 },
    lines: ['Dunmar thinks it is a god. I think it is weather. We are both afraid.', 'The gorge river feeds the stream. The stream feeds the coven. Everything flows into the witches.'],
    behaviour: { kind: 'stand', pose: 'watch', yaw: -Math.PI / 2 + 0.3 },
  },
  {
    id: 'cook', name: 'Mother Marrow', title: 'Who Stirs the Sea', weapon: 'staff',
    look: { cloth: 0x0a0d2a, armour: 0x1a1428, skin: 0xd8dcf0, accent: PALETTE.witch, skeleton: true, hat: true, hatColor: 0xdfe6ff, bulk: 0.8, height: 1.8 },
    lines: ['Stir it widdershins or it stirs you.', 'Rot salve. Thirty shards. It smells like the pot. It works like the pot.', 'The castle on the rock? I cooked for them once. They did not come back for seconds.'],
    behaviour: { kind: 'stand', pose: 'stir', yaw: Math.PI / 2 },
    shop: [{ itemId: 'rot-salve', price: 30 }, { itemId: 'witch-staff', price: 320 }],
    prop: 'spoon',
  },
  {
    id: 'aldous', name: 'Sir Aldous', title: 'Knight of the Tavern', weapon: 'greatsword',
    look: { ...knightLook, accent: PALETTE.rune },
    lines: ['Sit. The ale is cold and the moon is patient.', 'I have guarded worse roads than yours for less coin.', 'The fog takes the careless. Hire a sword that does not care.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI * 0.9 },
    hire: { cost: 120, atk: 70, maxHp: 1400, ranged: false },
    prop: 'mug',
  },
  {
    id: 'mirren', name: 'Mirren', title: 'Wizard of the Long Night', weapon: 'staff',
    look: { cloth: 0xc9d2f5, armour: 0x9aa8e0, skin: 0xd8dcf0, accent: PALETTE.dusk, hat: true, hatColor: 0xdfe6ff, beard: true, bulk: 0.85, height: 1.8 },
    lines: ['Every ruin here was a kingdom once. Buy something before it is a ruin again.', 'Moon dew heals. Lunar charms sharpen. Star charts remember.', 'The stars are not above us. They are behind the fog.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: -Math.PI * 0.1 },
    shop: [{ itemId: 'moon-dew', price: 35 }, { itemId: 'lunar-charm', price: 180 }, { itemId: 'travelers-blade', price: 220 }, { itemId: 'star-chart', price: 260 }],
    prop: 'mug',
  },
  {
    id: 'vigil', name: 'The Vigil', title: 'Knight who Kneels', weapon: 'sword',
    look: { ...knightLook, armour: 0x14183a, accent: PALETTE.moon },
    lines: ['I knelt here when the last bell rang. I am still listening.', 'If you walk toward the head, I will walk beside you.', 'My oath is cheap. My sword is not.'],
    behaviour: { kind: 'stand', pose: 'kneel', yaw: -Math.PI / 2 },
    hire: { cost: 200, atk: 85, maxHp: 1900, ranged: false },
  },
  {
    id: 'rattle', name: 'Rattle', title: 'Skeleton by the Fire', weapon: 'sword',
    look: { cloth: 0x2a2f55, armour: 0xd8dcf0, skin: 0xd8dcf0, accent: PALETTE.witch, skeleton: true, bulk: 0.7, height: 1.75 },
    lines: ['We died in the last war. Nobody told us which one.', 'The kettle never boils. We keep waiting anyway.', 'Sixty shards and I will rattle at your enemies.'],
    behaviour: { kind: 'stand', pose: 'sit', yaw: Math.PI * 0.5 },
    hire: { cost: 60, atk: 40, maxHp: 500, ranged: false },
  },
  {
    id: 'bone', name: 'Bone', title: 'Skeleton by the Fire', weapon: 'sword',
    look: { cloth: 0x2a2f55, armour: 0xd8dcf0, skin: 0xd8dcf0, accent: PALETTE.witch, skeleton: true, bulk: 0.7, height: 1.7 },
    lines: ['Rattle talks too much.', 'The fire is warm. That is all we remember about warm.'],
    behaviour: { kind: 'stand', pose: 'sit', yaw: Math.PI * 1.1 },
  },
  {
    id: 'marrow', name: 'Marrow', title: 'Skeleton by the Fire', weapon: 'sword',
    look: { cloth: 0x2a2f55, armour: 0xd8dcf0, skin: 0xd8dcf0, accent: PALETTE.witch, skeleton: true, bulk: 0.7, height: 1.8 },
    lines: ['...', 'The kettle. Watch the kettle.'],
    behaviour: { kind: 'stand', pose: 'sit', yaw: -Math.PI * 0.2 },
  },
  {
    id: 'croak', name: 'Brother Croak', title: 'Frog Monk of the Lotus Pond', weapon: 'staff',
    look: { cloth: 0x0f1430, armour: 0x14183a, skin: 0x3f7a4a, accent: PALETTE.rune, bulk: 0.95, height: 1.75 },
    lines: ['The lotus opens for the moon, not for you. Sit anyway.', 'Lotus tea steadies the blade hand. Thirty shards.', 'The Frog King dreams in the hollow. Do not wake him with iron.'],
    behaviour: { kind: 'stand', pose: 'read', yaw: Math.PI * 0.4 },
    shop: [{ itemId: 'lotus-tea', price: 30 }, { itemId: 'moon-dew', price: 40 }],
    prop: 'book',
  },
  {
    id: 'pim', name: 'Pim', title: 'Gnome Astronomer', weapon: 'staff',
    look: { cloth: 0x2a3a8a, armour: 0x1f2a6a, skin: 0xd8c9b8, accent: PALETTE.rune, hat: true, hatColor: 0xc8203a, beard: true, bulk: 0.9, height: 1.15 },
    lines: ['The galaxy turns once every age. I have counted three turns. I am very old, or very bored.', 'A star chart shows the hunters of this land on your map. Mirren sells them; I draw them.', 'Do not look at the moon when it smiles.'],
    behaviour: { kind: 'stand', pose: 'telescope', yaw: -Math.PI * 0.75 },
    prop: 'telescope',
  },
  {
    id: 'grub', name: 'Grub', title: 'Ogre Woodhauler', weapon: 'sword',
    look: { cloth: 0x1a2a3a, armour: 0x2a3a4a, skin: 0x4a6a5a, accent: PALETTE.witch, bulk: 1.7, height: 3.1 },
    lines: ['Logs. Heavy. Grub carry.', 'Village pays Grub in soup. Grub likes soup.'],
    behaviour: { kind: 'loop', path: [[-80, 120], [-30, 120], [-30, 128], [-80, 128]], speed: 1.6, pose: 'carry' },
    scale: 1,
    prop: 'logs',
  },
  {
    id: 'moss', name: 'Old Moss', title: 'Troll Fisher', weapon: 'staff',
    look: { cloth: 0x1a3a3a, armour: 0x2a4a4a, skin: 0x3a5a4a, accent: PALETTE.witch, bulk: 1.6, height: 2.6 },
    lines: ['Fish glow here. Everything glows here. Tastes the same.', 'Sat here three winters. River never stops. Neither does Moss.'],
    behaviour: { kind: 'stand', pose: 'fish', yaw: -Math.PI / 2 },
    prop: 'rod',
  },
  {
    id: 'gob-a', name: 'Snik', title: 'Tavern Goblin', weapon: 'sword',
    look: { cloth: 0x2a3a1a, armour: 0x3a4a2a, skin: 0x4a7a3a, accent: PALETTE.witch, hat: true, hatColor: 0x3a2e24, bulk: 0.9, height: 1.15 },
    lines: ['Grk. Mine.', 'Knight pays. Goblin drinks. Good arrangement.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI * 0.3 },
    prop: 'mug',
  },
  {
    id: 'gob-b', name: 'Vrak', title: 'Tavern Goblin', weapon: 'sword',
    look: { cloth: 0x1a2a2a, armour: 0x2a3a3a, skin: 0x3f6a3a, accent: PALETTE.witch, bulk: 0.95, height: 1.1 },
    lines: ['...hic.'],
    behaviour: { kind: 'stand', pose: 'sit', yaw: Math.PI * 1.4 },
  },
  {
    id: 'pilgrim-a', name: 'Pilgrim', title: 'Walker of the River', weapon: 'staff',
    look: { cloth: 0x0f1430, armour: 0x14183a, skin: 0x8c93b8, accent: PALETTE.fog, cape: true, bulk: 0.9, height: 1.8 },
    lines: ['We walk the river to the sea that is not there.', 'Keep the water on your left and the moon on your right.'],
    behaviour: { kind: 'loop', path: [[150, 36], [100, 10], [50, 30], [0, 40], [-50, 20], [-90, 34], [-50, 20], [0, 40], [50, 30], [100, 10]], speed: 1.3 },
  },
  {
    id: 'pilgrim-b', name: 'Pilgrim', title: 'Walker of the River', weapon: 'staff',
    look: { cloth: 0xc9d2f5, armour: 0x9aa8e0, skin: 0xb9c0e0, accent: PALETTE.moon, cape: true, hat: true, hatColor: 0xdfe6ff, bulk: 0.85, height: 1.75 },
    lines: ['The water remembers every kingdom. It keeps none.'],
    behaviour: { kind: 'loop', path: [[148, 39], [98, 13], [48, 33], [-2, 43], [-52, 23], [-92, 37], [-52, 23], [-2, 43], [48, 33], [98, 13]], speed: 1.3 },
  },
];

import { BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, SphereGeometry, Color } from 'three';
import { surface } from '../render/Materials';
import { glowSprite } from './Landmarks';

/** Hand-held or back-mounted props for NPCs. */
function attachProp(rig: Rig, prop: NonNullable<NpcDef['prop']>, height: number): void {
  const hand = rig.handR;
  const handL = rig.handL;
  switch (prop) {
    case 'mug': {
      const mug = new Mesh(new CylinderGeometry(0.06, 0.055, 0.14, 8), surface({ color: 0x8d7a5a }));
      const foam = new Mesh(new CylinderGeometry(0.06, 0.06, 0.03, 8), surface({ color: 0xf0e6c8 }));
      foam.position.y = 0.085;
      const glow = new Mesh(new CylinderGeometry(0.05, 0.05, 0.1, 8), new MeshBasicMaterial({ color: new Color(0xffa040).multiplyScalar(1.2), toneMapped: false }));
      mug.add(foam, glow);
      hand.add(mug);
      break;
    }
    case 'book': {
      const book = new Mesh(new BoxGeometry(0.34, 0.04, 0.26), surface({ color: 0x4a1020 }));
      const pages = new Mesh(new BoxGeometry(0.3, 0.02, 0.22), surface({ color: 0xe8e2d0 }));
      pages.position.y = 0.03;
      book.add(pages);
      book.position.set(-0.12, -0.02, 0.1);
      hand.add(book);
      break;
    }
    case 'rose': {
      const stem = new Mesh(new CylinderGeometry(0.008, 0.01, 0.4, 5), surface({ color: 0x1f4d46 }));
      stem.position.y = 0.2;
      const bloom = new Mesh(new SphereGeometry(0.06, 8, 6), new MeshBasicMaterial({ color: new Color(0xff2a2a).multiplyScalar(0.9), toneMapped: false }));
      bloom.position.y = 0.42;
      stem.add(bloom);
      stem.rotation.x = 0.4;
      hand.add(stem);
      break;
    }
    case 'spoon': {
      const spoon = new Mesh(new CylinderGeometry(0.02, 0.02, 1.1, 6), surface({ color: 0x3a2e24 }));
      spoon.position.y = -0.4;
      hand.add(spoon);
      break;
    }
    case 'banner': {
      const pole = new Mesh(new CylinderGeometry(0.025, 0.03, 2.8, 6), surface({ color: 0x1a1428 }));
      pole.position.y = 0.9;
      const flag = new Mesh(new PlaneGeometry(1.1, 0.8, 4, 3), surface({ color: 0x0a0d2a, side: DoubleSide, roughness: 0.9 }));
      flag.position.set(0.55, 1.8, 0);
      pole.add(flag);
      handL.add(pole);
      const trident = new Mesh(new CylinderGeometry(0.02, 0.025, 2.2, 6), surface({ color: 0x1a1428 }));
      trident.position.y = 0.7;
      for (const dx of [-0.12, 0, 0.12]) {
        const tine = new Mesh(new ConeGeometry(0.03, 0.35, 5), surface({ color: 0x9aa3cf, metalness: 0.7, roughness: 0.3 }));
        tine.position.set(dx, 1.95, 0);
        trident.add(tine);
      }
      hand.add(trident);
      rig.root.userData.flag = flag;
      break;
    }
    case 'lantern': {
      const cage = new Mesh(new BoxGeometry(0.16, 0.22, 0.16), surface({ color: 0x1a1428, transparent: true, opacity: 0.35 }));
      cage.position.y = -0.2;
      const flame = glowSprite(0xff7a2a, 0.6, 0.9, true);
      flame.position.y = -0.2;
      hand.add(cage, flame);
      rig.root.userData.lantern = flame;
      break;
    }
    case 'greatsword': {
      const blade = new Mesh(new BoxGeometry(0.1, 1.5, 0.025), surface({ color: 0x9aa3cf, metalness: 0.8, roughness: 0.3 }));
      blade.position.set(0.35, -0.55, 0.45);
      blade.rotation.x = 0.1;
      rig.root.add(blade);
      const sheen = new Mesh(new BoxGeometry(0.03, 1.1, 0.03), surface({ color: 0x05060f, emissive: 0xff2a2a, emissiveIntensity: 1.1 }));
      sheen.position.copy(blade.position);
      rig.root.add(sheen);
      break;
    }
    case 'rod': {
      const rod = new Mesh(new CylinderGeometry(0.015, 0.03, 2.6, 6), surface({ color: 0x3a2e24 }));
      rod.position.set(0, 0.6, 0.6);
      rod.rotation.x = 1.1;
      hand.add(rod);
      const line = new Mesh(new CylinderGeometry(0.004, 0.004, 1.6, 4), surface({ color: 0xdfe6ff }));
      line.position.set(0, 2.1, 0);
      rod.add(line);
      break;
    }
    case 'logs': {
      const bundle = new Mesh(new CylinderGeometry(0.3, 0.3, 3.2, 10), surface({ color: 0x3a2e24 }));
      bundle.rotation.z = Math.PI / 2;
      bundle.position.set(0, height * 0.72, -0.1);
      rig.chest.add(bundle);
      const b2 = bundle.clone();
      b2.position.y += 0.55;
      rig.chest.add(b2);
      break;
    }
    case 'telescope': {
      const scope = new Mesh(new CylinderGeometry(0.03, 0.045, 0.45, 8), surface({ color: 0x8a6a2a, metalness: 0.8, roughness: 0.3 }));
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0, 0.2);
      hand.add(scope);
      break;
    }
  }
  void CircleGeometry;
}

/** A talking, posed or wandering non-player character built on the party rig. */
export class Npc {
  readonly rig: Rig;
  readonly object: Group;
  readonly pos = new Vector3();
  yaw = 0;
  private seg = 0;
  private along = 0;
  private wanderTarget: { x: number; z: number } | null = null;
  private wanderWait = 0;
  private speed = 0;

  constructor(readonly def: NpcDef, start: { x: number; z: number }, private readonly heightAt: (x: number, z: number) => number) {
    this.rig = new Rig({ id: def.id, name: def.name, title: def.title, element: 'fog', weapon: def.weapon, maxHp: 1, atk: 1, look: def.look });
    this.object = this.rig.root;
    if (def.prop) attachProp(this.rig, def.prop, def.look.height);
    if (def.scale && def.scale !== 1) this.object.scale.setScalar(def.scale);
    this.pos.set(start.x, heightAt(start.x, start.z), start.z);
    if (def.behaviour.kind === 'stand') this.yaw = def.behaviour.yaw;
    if (def.behaviour.kind === 'loop') {
      this.pos.set(def.behaviour.path[0][0], 0, def.behaviour.path[0][1]);
      this.pos.y = heightAt(this.pos.x, this.pos.z);
    }
  }

  /** Distance from the player at which the talk prompt appears. */
  get talkRange(): number {
    return 4.2 * (this.def.scale ?? 1) * Math.max(1, this.def.look.height / 1.8);
  }

  update(dt: number, player: Vector3, talking: boolean): void {
    const b = this.def.behaviour;
    let moving = false;
    if (talking) {
      this.yaw = Math.atan2(player.z - this.pos.z, player.x - this.pos.x);
    } else if (b.kind === 'loop') {
      const a = b.path[this.seg];
      const c = b.path[(this.seg + 1) % b.path.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      this.along += dt * b.speed;
      if (this.along >= len) { this.along = 0; this.seg = (this.seg + 1) % b.path.length; }
      const t = Math.min(1, this.along / len);
      this.pos.x = a[0] + (c[0] - a[0]) * t;
      this.pos.z = a[1] + (c[1] - a[1]) * t;
      const target = Math.atan2(c[1] - a[1], c[0] - a[0]);
      this.yaw += Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw)) * Math.min(1, dt * 5);
      moving = true;
      this.speed = b.speed;
    } else if (b.kind === 'wander') {
      if (!this.wanderTarget) {
        this.wanderWait -= dt;
        if (this.wanderWait <= 0) {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * b.radius;
          this.wanderTarget = { x: b.x + Math.cos(ang) * r, z: b.z + Math.sin(ang) * r };
        }
      } else {
        const dx = this.wanderTarget.x - this.pos.x;
        const dz = this.wanderTarget.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.4) { this.wanderTarget = null; this.wanderWait = 2 + Math.random() * 4; }
        else {
          this.pos.x += (dx / d) * b.speed * dt;
          this.pos.z += (dz / d) * b.speed * dt;
          const target = Math.atan2(dz, dx);
          this.yaw += Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw)) * Math.min(1, dt * 5);
          moving = true;
          this.speed = b.speed;
        }
      }
    }
    if (moving) this.pos.y += (this.heightAt(this.pos.x, this.pos.z) - this.pos.y) * Math.min(1, dt * 8);
    this.object.position.copy(this.pos);
    this.object.rotation.y = -this.yaw - Math.PI / 2;
    const pose = talking ? undefined : b.kind === 'stand' ? b.pose : b.kind === 'loop' ? b.pose : undefined;
    this.rig.animate({ mode: 'ground', speed: moving ? this.speed : 0, pose }, dt);
    const flag = this.object.userData.flag as Mesh | undefined;
    if (flag) {
      const pos = flag.geometry.attributes.position;
      const tnow = performance.now() / 1000;
      for (let i = 0; i < pos.count; i++) { const fx = (pos.getX(i) + 0.55) / 1.1; pos.setZ(i, Math.sin(tnow * 5 + fx * 6) * 0.18 * fx); }
      pos.needsUpdate = true;
    }
  }
}
