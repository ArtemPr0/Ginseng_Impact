import { Group, Vector3 } from 'three';
import { yawToRotation } from '../models/ModelRig';
import { Rig, type RigPose } from '../characters/Rig';
import type { CharacterDef } from '../characters/roster';
import { MODELS } from '../data/models';
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
  /** Meshy model id (several NPCs share one body). */
  model: string;
  /** Placeholder and trail colour. */
  accent: number;
  weapon: CharacterDef['weapon'];
  lines: string[];
  behaviour: NpcBehaviour;
  /** Items for sale (buy) — the NPC also buys any material. */
  shop?: ShopEntry[];
  /** Hire as a companion for this many shards. */
  hire?: { cost: number; atk: number; maxHp: number; ranged: boolean };
  /** Scale multiplier applied to the rig (ogres, trolls). */
  scale?: number;
}

export const NPC_DEFS: NpcDef[] = [
  {
    id: 'king', name: 'The Antlered King', title: 'Who Buys What the Fog Drops', weapon: 'sword',
    model: 'king', accent: PALETTE.witch,
    lines: ['Kneel or do not. The candles do not care.', 'Bring me what the great ones drop. I pay in shards and in silence.', 'My crown was antlers before it was gold. Everything here was something else first.'],
    behaviour: { kind: 'stand', pose: 'throne', yaw: -Math.PI / 2 },
    shop: [{ itemId: 'crown-blade', price: 900 }, { itemId: 'moon-dew', price: 30 }, { itemId: 'star-chart', price: 220 }],
  },
  {
    id: 'sentry', name: 'Sir Halvard', title: 'Knight of the Lonely Cliff', weapon: 'greatsword',
    model: 'knight-seated', accent: PALETTE.blood,
    lines: ['Those windows have been lit for a hundred years. No one has come out.', 'I sit. I watch. For three hundred shards I will stand.', 'The pass below is the beast\'s. Go around, or go with me.'],
    behaviour: { kind: 'stand', pose: 'sitSword', yaw: Math.PI * 0.6 },
    hire: { cost: 300, atk: 95, maxHp: 2200, ranged: false },
  },
  {
    id: 'standard', name: 'Hollow Jack', title: 'Standard-Bearer of No Army', weapon: 'staff',
    model: 'skeleton-banner', accent: PALETTE.rune,
    lines: ['The banner is for a kingdom that lost. I kept the banner.', 'Wind up here never stops. Neither does the aurora. Neither do I.'],
    behaviour: { kind: 'stand', pose: 'banner', yaw: Math.PI * 0.25 },
  },
  {
    id: 'bride', name: 'The Pale Bride', title: 'Who Walks to the Sea', weapon: 'staff',
    model: 'bride', accent: PALETTE.moon,
    lines: ['He said he would meet me where the sand ends.', 'The sand does not end. I keep walking.', '...do you hear the bells?'],
    behaviour: { kind: 'loop', path: [[56, 96], [74, 108], [90, 100], [74, 108]], speed: 0.9 },
  },
  {
    id: 'rose-knight', name: 'Sir Corvin', title: 'Who Brought a Rose', weapon: 'sword',
    model: 'knight-rose', accent: PALETTE.blood,
    lines: ['Do not speak loudly. She has not said yes yet.', 'A rose from the Last Garden. Red ones are rare here.'],
    behaviour: { kind: 'stand', pose: 'offer', yaw: Math.PI },
  },
  {
    id: 'maiden', name: 'Elowen', title: 'Of the Flower Garden', weapon: 'staff',
    model: 'maiden', accent: PALETTE.electric,
    lines: ['He walked through the fog for this. I am deciding.', 'The blue ones mean waiting. The red ones mean now.'],
    behaviour: { kind: 'stand', pose: 'bow', yaw: 0 },
  },
  {
    id: 'wanderer', name: 'The Lanternbearer', title: 'Who Has Seen the Burning Shore', weapon: 'staff',
    model: 'wanderer', accent: 0xff7a2a,
    lines: ['Across the water a castle burns and never falls. I stopped asking why.', 'Follow the lantern if you like. It only ever leads to the edge.'],
    behaviour: { kind: 'loop', path: [[-48, -40], [-10, -52], [30, -66], [-10, -52]], speed: 1.1, pose: 'lantern' },
  },
  {
    id: 'watcher-knight', name: 'Dunmar', title: 'Who Watches the Sky', weapon: 'sword',
    model: 'knight-npc', accent: PALETTE.electric,
    lines: ['It came out of the storm with a face. We have not moved since.', 'If it blinks, run.'],
    behaviour: { kind: 'stand', pose: 'watch', yaw: -Math.PI / 2 },
  },
  {
    id: 'watcher-mage', name: 'Sel', title: 'Who Watches the Sky', weapon: 'staff',
    model: 'wizard-npc', accent: PALETTE.rune,
    lines: ['Dunmar thinks it is a god. I think it is weather. We are both afraid.', 'The gorge river feeds the stream. The stream feeds the coven. Everything flows into the witches.'],
    behaviour: { kind: 'stand', pose: 'watch', yaw: -Math.PI / 2 + 0.3 },
  },
  {
    id: 'cook', name: 'Mother Marrow', title: 'Who Stirs the Sea', weapon: 'staff',
    model: 'witch-cook', accent: PALETTE.witch,
    lines: ['Stir it widdershins or it stirs you.', 'Rot salve. Thirty shards. It smells like the pot. It works like the pot.', 'The castle on the rock? I cooked for them once. They did not come back for seconds.'],
    behaviour: { kind: 'stand', pose: 'stir', yaw: Math.PI / 2 },
    shop: [{ itemId: 'rot-salve', price: 30 }, { itemId: 'witch-staff', price: 320 }],
  },
  {
    id: 'aldous', name: 'Sir Aldous', title: 'Knight of the Tavern', weapon: 'greatsword',
    model: 'knight-npc', accent: PALETTE.rune,
    lines: ['Sit. The ale is cold and the moon is patient.', 'I have guarded worse roads than yours for less coin.', 'The fog takes the careless. Hire a sword that does not care.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI * 0.9 },
    hire: { cost: 120, atk: 70, maxHp: 1400, ranged: false },
  },
  {
    id: 'mirren', name: 'Mirren', title: 'Wizard of the Long Night', weapon: 'staff',
    model: 'wizard-npc', accent: PALETTE.dusk,
    lines: ['Every ruin here was a kingdom once. Buy something before it is a ruin again.', 'Moon dew heals. Lunar charms sharpen. Star charts remember.', 'The stars are not above us. They are behind the fog.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: -Math.PI * 0.1 },
    shop: [{ itemId: 'moon-dew', price: 35 }, { itemId: 'lunar-charm', price: 180 }, { itemId: 'travelers-blade', price: 220 }, { itemId: 'star-chart', price: 260 }],
  },
  {
    id: 'vigil', name: 'The Vigil', title: 'Knight who Kneels', weapon: 'sword',
    model: 'knight-npc', accent: PALETTE.moon,
    lines: ['I knelt here when the last bell rang. I am still listening.', 'If you walk toward the head, I will walk beside you.', 'My oath is cheap. My sword is not.'],
    behaviour: { kind: 'stand', pose: 'kneel', yaw: -Math.PI / 2 },
    hire: { cost: 200, atk: 85, maxHp: 1900, ranged: false },
  },
  {
    id: 'rattle', name: 'Rattle', title: 'Skeleton by the Fire', weapon: 'sword',
    model: 'skeleton', accent: PALETTE.witch,
    lines: ['We died in the last war. Nobody told us which one.', 'The kettle never boils. We keep waiting anyway.', 'Sixty shards and I will rattle at your enemies.'],
    behaviour: { kind: 'stand', pose: 'sit', yaw: Math.PI * 0.5 },
    hire: { cost: 60, atk: 40, maxHp: 500, ranged: false },
  },
  {
    id: 'bone', name: 'Bone', title: 'Skeleton by the Fire', weapon: 'sword',
    model: 'skeleton', accent: PALETTE.witch,
    lines: ['Rattle talks too much.', 'The fire is warm. That is all we remember about warm.'],
    behaviour: { kind: 'stand', pose: 'sit', yaw: Math.PI * 1.1 },
  },
  {
    id: 'marrow', name: 'Marrow', title: 'Skeleton by the Fire', weapon: 'sword',
    model: 'skeleton', accent: PALETTE.witch,
    lines: ['...', 'The kettle. Watch the kettle.'],
    behaviour: { kind: 'stand', pose: 'sit', yaw: -Math.PI * 0.2 },
  },
  {
    id: 'croak', name: 'Brother Croak', title: 'Frog Monk of the Lotus Pond', weapon: 'staff',
    model: 'frog-monk', accent: PALETTE.rune,
    lines: ['The lotus opens for the moon, not for you. Sit anyway.', 'Lotus tea steadies the blade hand. Thirty shards.', 'The Frog King dreams in the hollow. Do not wake him with iron.'],
    behaviour: { kind: 'stand', pose: 'read', yaw: Math.PI * 0.4 },
    shop: [{ itemId: 'lotus-tea', price: 30 }, { itemId: 'moon-dew', price: 40 }],
  },
  {
    id: 'pim', name: 'Pim', title: 'Gnome Astronomer', weapon: 'staff',
    model: 'gnome', accent: PALETTE.rune,
    lines: ['The galaxy turns once every age. I have counted three turns. I am very old, or very bored.', 'A star chart shows the hunters of this land on your map. Mirren sells them; I draw them.', 'Do not look at the moon when it smiles.'],
    behaviour: { kind: 'stand', pose: 'telescope', yaw: -Math.PI * 0.75 },
  },
  {
    id: 'grub', name: 'Grub', title: 'Ogre Woodhauler', weapon: 'sword',
    model: 'ogre', accent: PALETTE.witch,
    lines: ['Logs. Heavy. Grub carry.', 'Village pays Grub in soup. Grub likes soup.'],
    behaviour: { kind: 'loop', path: [[-80, 120], [-30, 120], [-30, 128], [-80, 128]], speed: 1.6, pose: 'carry' },
    scale: 1,
  },
  {
    id: 'moss', name: 'Old Moss', title: 'Troll Fisher', weapon: 'staff',
    model: 'troll-fisher', accent: PALETTE.witch,
    lines: ['Fish glow here. Everything glows here. Tastes the same.', 'Sat here three winters. River never stops. Neither does Moss.'],
    behaviour: { kind: 'stand', pose: 'fish', yaw: -Math.PI / 2 },
  },
  {
    id: 'gob-a', name: 'Snik', title: 'Tavern Goblin', weapon: 'sword',
    model: 'goblin', accent: PALETTE.witch,
    lines: ['Grk. Mine.', 'Knight pays. Goblin drinks. Good arrangement.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI * 0.3 },
  },
  {
    id: 'gob-b', name: 'Vrak', title: 'Tavern Goblin', weapon: 'sword',
    model: 'goblin', accent: PALETTE.witch,
    lines: ['...hic.'],
    behaviour: { kind: 'stand', pose: 'sit', yaw: Math.PI * 1.4 },
  },
  {
    id: 'pilgrim-a', name: 'Pilgrim', title: 'Walker of the River', weapon: 'staff',
    model: 'pilgrim', accent: PALETTE.fog,
    lines: ['We walk the river to the sea that is not there.', 'Keep the water on your left and the moon on your right.'],
    behaviour: { kind: 'loop', path: [[150, 36], [100, 10], [50, 30], [0, 40], [-50, 20], [-90, 34], [-50, 20], [0, 40], [50, 30], [100, 10]], speed: 1.3 },
  },
  {
    id: 'pilgrim-b', name: 'Pilgrim', title: 'Walker of the River', weapon: 'staff',
    model: 'pilgrim', accent: PALETTE.moon,
    lines: ['The water remembers every kingdom. It keeps none.'],
    behaviour: { kind: 'loop', path: [[148, 39], [98, 13], [48, 33], [-2, 43], [-52, 23], [-92, 37], [-52, 23], [-2, 43], [48, 33], [98, 13]], speed: 1.3 },
  },
];

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
    this.rig = new Rig({ id: def.id, name: def.name, title: def.title, element: 'fog', weapon: def.weapon, maxHp: 1, atk: 1, accent: def.accent }, def.model);
    this.object = this.rig.root;
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
    return 4.2 * (this.def.scale ?? 1) * Math.max(1, (MODELS[this.def.model]?.height ?? 1.8) / 1.8);
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
    this.object.rotation.y = yawToRotation(this.yaw);
    const pose = talking ? undefined : b.kind === 'stand' ? b.pose : b.kind === 'loop' ? b.pose : undefined;
    this.rig.animate({ mode: 'ground', speed: moving ? this.speed : 0, pose }, dt);
  }
}
