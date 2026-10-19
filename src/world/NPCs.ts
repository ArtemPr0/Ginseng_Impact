import { Group, Vector3 } from 'three';
import { yawToRotation } from '../models/ModelRig';
import { Rig, type RigPose } from '../characters/Rig';
import type { CharacterDef } from '../characters/roster';
import { MODELS } from '../data/models';
import { PALETTE } from '../render/palette';
import { SpeechBubble } from './SpeechBubble';
import { voiceUrl, VOICES } from '../data/voices';

export type NpcBehaviour =
  | { kind: 'stand'; pose?: RigPose['pose']; yaw: number }
  | { kind: 'loop'; path: Array<[number, number]>; speed: number; pose?: RigPose['pose'] }
  | { kind: 'wander'; x: number; z: number; radius: number; speed: number }
  /**
   * A guard in a doorway: he blocks it, facing out (`yaw`), until the player comes within `trigger` metres; then he
   * says his line (a data/voices id), steps `aside` to that spot and turns to `asideYaw`, and the way is open.
   */
  | { kind: 'guard'; yaw: number; aside: [number, number]; asideYaw: number; trigger: number; line: string; pose?: RigPose['pose'] };

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
  /** Holds a lean cup (a body whose mesh has none: the drink clip lifts an empty hand otherwise). */
  cup?: boolean;
  /** Hire as a companion for this many shards. */
  hire?: { cost: number; atk: number; maxHp: number; ranged: boolean };
  /**
   * A recorded line the NPC says by itself when the player is near (between sips for the cup gnome): the file
   * under public/audio, the caption shown in a speech bubble, the pause between repeats and the hearing range.
   */
  voice?: { url: string; caption: string; every: number; range: number; firstAfter?: number };
  /** Slurp at this fraction of the drink clip (the moment the cup meets the mouth). */
  sipAt?: number;
  /** Scale multiplier applied to the rig (ogres, trolls). */
  scale?: number;
}

export const NPC_DEFS: NpcDef[] = [
  {
    id: 'king', name: 'The Antlered King', title: 'Who Buys What the Fog Drops', weapon: 'sword',
    model: 'king', accent: PALETTE.witch,
    lines: ['Kneel or do not. The candles do not care.', 'Bring me what the great ones drop. I pay in shards and in silence.', 'My crown was antlers before it was gold. Everything here was something else first.'],
    behaviour: { kind: 'stand', pose: 'throne', yaw: Math.PI / 2 },
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
    // Across the desert toward the south-east shore, where the sand ends at the cliff.
    behaviour: { kind: 'loop', path: [[40, 60], [50, 62], [58, 56], [50, 62]], speed: 0.9 },
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
    lines: ['Across the water a castle burns and never falls. I stopped asking why.', 'Follow the lantern if you like. It only ever leads back down this street.'],
    // Up and down the street of the village in the forest, lantern held out.
    behaviour: { kind: 'loop', path: [[-52, 70], [-30, 70.4], [-12, 70], [-30, 69.6]], speed: 1.1, pose: 'lantern' },
  },
  {
    id: 'watcher-knight', name: 'Dunmar', title: 'Guard of the Porcelain Hall', weapon: 'sword',
    model: 'knight-npc', accent: PALETTE.electric,
    lines: ['The King is inside. Mind the porcelain.', 'I stand here so the snow stays out. Mostly it does not.'],
    // In the doorway of Yung Lean's hall (its opening is x 997-1003 at z -53.5), stepping aside for the hero.
    behaviour: { kind: 'guard', yaw: Math.PI / 2, aside: [1004.6, -51.8], asideYaw: Math.PI, trigger: 7, line: 'guard-cool', pose: 'watch' },
  },
  {
    id: 'watcher-mage', name: 'Sel', title: 'Who Watches the Snow', weapon: 'staff',
    model: 'wizard-npc', accent: PALETTE.rune,
    lines: ['The snow here falls in little squares. I came to study it and forgot to leave.', 'Dunmar guards the hall now. I watch the houses breathe.'],
    // At the east end of the street of purple houses, looking down it.
    behaviour: { kind: 'stand', pose: 'watch', yaw: Math.PI },
  },
  {
    id: 'cook', name: 'Mother Marrow', title: 'Who Stirs the Sea', weapon: 'staff',
    model: 'witch-cook', accent: PALETTE.witch,
    lines: ['Stir it widdershins or it stirs you.', 'Rot salve. Thirty shards. It smells like the pot. It works like the pot.', 'The castle on the rock? I cooked for them once. They did not come back for seconds.'],
    behaviour: { kind: 'stand', pose: 'stir', yaw: Math.PI },
    shop: [{ itemId: 'rot-salve', price: 30 }, { itemId: 'witch-staff', price: 320 }],
  },
  {
    id: 'aldous', name: 'Sir Aldous', title: 'Knight of the Tavern', weapon: 'greatsword',
    model: 'knight-npc', accent: PALETTE.rune,
    lines: ['Sit. The ale is cold and the moon is patient.', 'I have guarded worse roads than yours for less coin.', 'The fog takes the careless. Hire a sword that does not care.'],
    cup: true,
    behaviour: { kind: 'stand', pose: 'drink', yaw: -Math.PI / 2 },
    hire: { cost: 120, atk: 70, maxHp: 1400, ranged: false },
  },
  {
    id: 'mirren', name: 'Mirren', title: 'Wizard of the Long Night', weapon: 'staff',
    model: 'wizard-npc', accent: PALETTE.dusk,
    lines: ['Every ruin here was a kingdom once. Buy something before it is a ruin again.', 'Moon dew heals. Lunar charms sharpen. Star charts remember.', 'The stars are not above us. They are behind the fog.'],
    cup: true,
    behaviour: { kind: 'stand', pose: 'drink', yaw: -Math.PI / 2 },
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
    id: 'croak', name: 'Brother Croak', title: 'Frog Monk of the Lotus Pond', weapon: 'staff',
    model: 'frog-monk', accent: PALETTE.rune,
    lines: ['The lotus opens for the moon, not for you. Sit anyway.', 'Lotus tea steadies the blade hand. Thirty shards.', 'The Frog King dreams in the hollow. Do not wake him with iron.'],
    behaviour: { kind: 'stand', pose: 'read', yaw: Math.PI * 0.4 },
    shop: [{ itemId: 'lotus-tea', price: 30 }, { itemId: 'moon-dew', price: 40 }],
  },
  {
    id: 'frogking', name: 'The Frog King', title: 'Who Dreams in the Hollow', weapon: 'sword',
    model: 'frogking', accent: PALETTE.dusk,
    lines: ['Ribbit. The hollow is mine, and the dreams in it.', 'My skin remembers colours you have never seen.', 'Croak was such a good tadpole.'],
    behaviour: { kind: 'stand', yaw: Math.PI / 2 },
  },
  {
    id: 'brother', name: 'Glintgrin', title: "Goldgrin's Brother", weapon: 'sword',
    model: 'gnome-brother', accent: PALETTE.rune,
    lines: ['These grills? Real diamonds. Mostly.', 'Goldgrin got the cup. I got the teeth. Fair split.', 'Close the round door on your way out. Draughts.'],
    behaviour: { kind: 'stand', yaw: Math.PI },
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
    // Logs from the west woods down the village street and back.
    behaviour: { kind: 'loop', path: [[-58, 70], [-34, 70], [-8, 70], [-34, 70]], speed: 1.6, pose: 'carry' },
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
    cup: true,
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI / 2 },
  },
  {
    id: 'gob-b', name: 'Vrak', title: 'Tavern Goblin', weapon: 'sword',
    model: 'goblin', accent: PALETTE.witch,
    lines: ['...hic.'],
    behaviour: { kind: 'stand', pose: 'sit', yaw: Math.PI / 2 },
  },
  // The user's own gnome (docs/reference/frames/cup-gnome.png): sips his cup and asks after Young Lean.
  {
    id: 'cup-gnome', name: 'Goldgrin', title: 'Gnome of the Purple Cup', weapon: 'staff',
    model: 'cup-gnome', accent: PALETTE.dusk,
    lines: ['Where is Young Lean?', 'Tall fella. Sad songs. Big coat. You seen him?', 'Two cups. One for me, one for when he shows up.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.atan2(59 - 64, 0 - 6.5) },
    voice: { url: '/audio/where-is-young-lean.mp3', caption: 'Where is Young Lean?', every: 7, range: 16 },
    sipAt: 0.34,
  },
  // --- Fifth batch of reels ---
  {
    id: 'grumble', name: 'Grumble', title: 'Gnome of the Mushroom Tavern', weapon: 'staff',
    model: 'gnome', accent: PALETTE.blood,
    lines: ['Off my table. I was here before the table.', 'The lamps are mushrooms. The mushrooms are lamps. Nobody asks which came first.', 'Lift me again and I bite.'],
    behaviour: { kind: 'stand', pose: 'watch', yaw: Math.PI / 2 },
    shop: [{ itemId: 'lotus-tea', price: 28 }, { itemId: 'moon-dew', price: 34 }],
  },
  {
    id: 'priest', name: 'The Root Priest', title: 'Keeper of the World Tree', weapon: 'staff',
    model: 'robed-priest', accent: PALETTE.rune,
    lines: ['The light runs up the bark like water runs down a hill. Backwards. Always backwards.', 'Every stone here has a name carved on it. Mine is not carved yet.', 'A rider burns through the dead wood at night. Let him pass.'],
    behaviour: { kind: 'stand', pose: 'pray', yaw: -Math.PI / 2 },
  },
  {
    id: 'lantern-witch', name: 'The Lantern Witch', title: 'Who Watches the Spire City', weapon: 'staff',
    model: 'witch', accent: PALETTE.witch,
    lines: ['The city across the water has more bridges than people.', 'Keep your lantern low. The aqueducts are listening.', 'I came to see the waterfalls. That was a long time ago.'],
    behaviour: { kind: 'stand', pose: 'lantern', yaw: Math.PI },
  },
  {
    id: 'skeleton-king', name: 'The Skeleton King', title: 'Counter of Coins', weapon: 'sword',
    model: 'skeleton-king', accent: PALETTE.moon,
    lines: ['Every coin on these stones was paid to cross the portal. Some paid twice.', 'Bring me what the great ones drop. I pay better than the antlered fool on the island.', 'The crystals grow from the ceiling because the ceiling is the sky.'],
    // On the dragon throne at the head of the court, facing down it (+z).
    behaviour: { kind: 'stand', pose: 'throne', yaw: Math.PI / 2 },
    shop: [{ itemId: 'moon-dew', price: 26 }, { itemId: 'star-chart', price: 200 }],
  },
  // (Old Hollowstaff, the skeleton wizard of the bucket street, is a boss now: data/enemies 'diamond-wizard'.)
  {
    id: 'galaxy-wizard', name: 'The Star Brewer', title: 'Wizard of the Round Tower', weapon: 'staff',
    model: 'galaxy-wizard', accent: PALETTE.dusk,
    lines: ['Pink is the colour of a potion that has made up its mind.', 'Meteors fall past my window every night. I have stopped wishing.', 'One sip and you will see the city as I do. Thirty shards.'],
    behaviour: { kind: 'stand', pose: 'stir', yaw: 0 },
    shop: [{ itemId: 'lotus-tea', price: 30 }],
  },
  {
    id: 'yunglean', name: 'Yung Lean', title: 'King of the Sad Side of the World', weapon: 'sword',
    model: 'rift-king', accent: PALETTE.dusk,
    lines: ['Bittersweet... everything is bittersweet.', 'The porcelain cracks easily. Walk soft.', 'Ginseng in the floor, snow in the sky. It is enough. It is never enough.'],
    behaviour: { kind: 'stand', pose: 'throne', yaw: Math.PI / 2 },
    // His idle line, when you have been standing around near him a while.
    voice: { url: '/audio/lean-idle.mp3', caption: 'Bittersweet... everything is bittersweet. Do you happen to have any iced tea on you? No? Shame.', every: 70, range: 9, firstAfter: 25 },
  },
  {
    id: 'void-monk', name: 'The Void Monk', title: 'Keeper of the Ring Portals', weapon: 'staff',
    model: 'void-monk', accent: PALETTE.dusk,
    lines: ['Each ring holds a sky. Only one of them leads home.', 'Step into the swirl to return to the island.', 'My face? It was a face. Now it is a door.'],
    behaviour: { kind: 'stand', yaw: Math.PI },
  },
  {
    id: 'market-a', name: 'Snaggle', title: 'Goblin Merchant of the Kingdom', weapon: 'sword',
    model: 'goblin', accent: PALETTE.witch,
    lines: ['Crystal ball, slightly used, shows mostly next Tuesday.', 'Everything here is porcelain. Prices too: they crack.', 'Mind the lean waves. They have opinions.'],
    // Behind his stall between two of the purple houses, facing the street.
    behaviour: { kind: 'stand', pose: 'offer', yaw: Math.PI / 2 },
    shop: [{ itemId: 'moon-dew', price: 32 }, { itemId: 'rot-salve', price: 28 }],
  },
  {
    id: 'market-b', name: 'Grizzle', title: 'Goblin Merchant of the Kingdom', weapon: 'sword',
    model: 'goblin', accent: PALETTE.blood,
    lines: ['Lanterns! Lanterns that remember where you left them!', 'Snaggle overcharges. I overcharge less.'],
    behaviour: { kind: 'stand', pose: 'offer', yaw: -Math.PI / 2 },
    shop: [{ itemId: 'lotus-tea', price: 26 }],
  },
  // --- Round 6: the Lean Quarter (@returndark reels DeXn5rSPxR8, Den1ausBXai, DeldocTvFiB, Def4LDkxikA) ---
  {
    id: 'skeleton-lord', name: 'The Skeleton Lord', title: 'Who Breathes the Purple Smoke', weapon: 'sword',
    model: 'skeleton-lord', accent: PALETTE.dusk,
    lines: ['Every diamond in these teeth was a promise someone broke.', 'Sit. The smoke is free. The view costs.', 'The carriage brings guests to the castle. The castle keeps them.'],
    cup: true,
    behaviour: { kind: 'stand', pose: 'sit', yaw: Math.PI },
  },
  {
    id: 'court-knight', name: 'Sir Cobalt', title: 'Guest of the Pavilion', weapon: 'sword',
    model: 'blue-knight', accent: PALETTE.electric,
    lines: ['I came for one goblet. That was many goblets ago.', 'My sword is ice. It never melts in here: nothing does.', 'He talks in smoke. I nod. It works.'],
    cup: true,
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI },
    sipAt: 0.42,
  },
  {
    id: 'potion-brewer', name: 'Merrow the Pourer', title: 'Keeper of the Galaxy Bottles', weapon: 'staff',
    model: 'wizard-npc', accent: PALETTE.dusk,
    lines: ['Each bottle holds a little night sky. Shake it and the stars rearrange.', 'The fountains pour lean. Sip from the basins if you are brave, it spins the world.', 'Do not drink the one with the planet in it.'],
    behaviour: { kind: 'stand', pose: 'stir', yaw: Math.PI / 2 },
    shop: [{ itemId: 'lotus-tea', price: 30 }, { itemId: 'star-chart', price: 210 }],
  },
  {
    id: 'bartender', name: 'Old Ribs', title: 'Bartender of the Sky Bar', weapon: 'sword',
    model: 'skeleton-lord', accent: PALETTE.dusk,
    lines: ['Ice, straw, a slice of orange. House style.', 'The dragon drinks on credit. You do not.', 'Mind the edge. The last fellow who leaned too far is still falling.'],
    cup: true,
    behaviour: { kind: 'stand', pose: 'offer', yaw: Math.PI * 0.75 },
    shop: [{ itemId: 'moon-dew', price: 30 }, { itemId: 'lotus-tea', price: 26 }],
  },
  {
    id: 'dock-knight', name: 'Sir Velvet', title: 'Who Drinks With the Dragon', weapon: 'sword',
    model: 'blue-knight', accent: PALETTE.electric,
    lines: ['He is called Grillmaw. Do not stare at his teeth, he knows they are nice.', 'We watch the sun go down from here. It never quite does.', 'One more cup and then we fly. Probably.'],
    cup: true,
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI },
    sipAt: 0.42,
  },
  {
    id: 'plague-doctor', name: 'The Plague Doctor', title: 'Who Prescribes the Purple', weapon: 'staff',
    model: 'plague-doctor', accent: PALETTE.blood,
    lines: ['Symptoms? Slowness. Purple vision. My diagnosis: you need another cup.', 'The chest is full of medicine. And gold. Mostly gold.', 'I make house calls. The houses are all graves out here.'],
    // (Lounging on his chest: the model is one piece with it.)
    behaviour: { kind: 'stand', yaw: Math.PI * 0.85 },
    shop: [{ itemId: 'rot-salve', price: 24 }, { itemId: 'moon-dew', price: 30 }],
  },
  {
    id: 'crypt-red', name: 'Rattlebones', title: 'Regular of the Crypt Bar', weapon: 'sword',
    model: 'skeleton-red', accent: PALETTE.witch,
    lines: ['Green eyes? Lean does that. To skeletons.', 'This coat was red when I bought it. So was I.', 'Cheers to the snow. It never asks for anything.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI * 0.4 },
    sipAt: 0.42,
  },
  {
    id: 'crypt-witch', name: 'Mother Grin', title: 'Who Wears the Tall Hat', weapon: 'staff',
    model: 'skeleton-witch', accent: PALETTE.dusk,
    lines: ['The hat stays on. The head under it is optional.', 'Gold teeth, gold chain, purple cup. A lady keeps standards.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI * 0.42 },
    sipAt: 0.42,
  },
  {
    id: 'crypt-bones', name: 'Knuckles', title: 'Who Counts the Skulls', weapon: 'sword',
    model: 'skeleton', accent: PALETTE.moon,
    lines: ['Four hundred and twelve skulls on that wall. I check every night.', 'Some of them are friends. Some of them owe me a drink.'],
    cup: true,
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI },
    sipAt: 0.42,
  },
  {
    id: 'gold-knight', name: 'Sir Gilt', title: 'Who Toasts the Dead', weapon: 'sword',
    model: 'gold-knight', accent: PALETTE.dusk,
    lines: ['To the dead! They are excellent company and never leave early.', 'The skulls behind me were knights. Raise your cup to them.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI / 2 },
    sipAt: 0.42,
  },
  // --- Round 6: the Dragon's Vale (Dd5Bqt7vQ5T); the toasters stand round the long table in its tavern (Interiors.ts) ---
  {
    id: 'waxwick', name: 'Waxwick', title: 'The Man With the Candle Head', weapon: 'staff',
    model: 'candle-head', accent: PALETTE.moon,
    lines: ['Mind the drips. Everything I say comes out warm.', 'A toast! To short wicks and long nights.', 'I do not blow out. I have tried.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI / 2 },
    sipAt: 0.42,
  },
  {
    id: 'brannoc', name: 'Brannoc', title: 'Dwarf of the Blue Mail', weapon: 'sword',
    model: 'dwarf', accent: PALETTE.electric,
    lines: ['Raise it higher! The candle in the cup is for luck, not for drinking.', 'The dragon? He sleeps through the singing. We have checked.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI / 4 },
    sipAt: 0.42,
  },
  {
    id: 'hilde', name: 'Hilde', title: 'Dwarf of the Braided Beard', weapon: 'sword',
    model: 'dwarf', accent: PALETTE.blood,
    lines: ['Three braids for three wars. The fourth is for the ale.', 'If the head on the hill ever opens its eyes, I am leaving.'],
    behaviour: { kind: 'stand', pose: 'drink', yaw: Math.PI * 0.75 },
    sipAt: 0.42,
  },
  {
    id: 'dragon-reader', name: 'The Dragon\'s Reader', title: 'Who Reads Him to Sleep', weapon: 'staff',
    model: 'wizard-npc', accent: PALETTE.rune,
    lines: ['Chapter nine. He likes chapter nine; he snores through the rest.', 'Do not wake him. His dreams are the only thing keeping the castle in the air.', 'The book glows when the story is true.'],
    behaviour: { kind: 'stand', pose: 'read', yaw: Math.PI / 2 },
  },
  {
    id: 'vale-knight', name: 'Sir Rowan', title: 'Watch of the Vale', weapon: 'sword',
    model: 'knight-npc', accent: PALETTE.blood,
    lines: ['The stone king on the hill wore his crown to bed and never woke.', 'The castle over the clouds sends a lantern down on chains when it wants something.', 'Stay on the street at night. The lanterns know the way home.'],
    behaviour: { kind: 'stand', yaw: Math.PI },
  },
  {
    id: 'vale-beggar', name: 'Old Penny', title: 'Who Asks for Shards', weapon: 'staff',
    model: 'wanderer', accent: PALETTE.moon,
    lines: ['A shard for an old woman? I will tell you which stall waters its ale.', 'I was rich once. Then I lent the dragon money.'],
    behaviour: { kind: 'stand', pose: 'sit', yaw: 0 },
  },
  {
    id: 'vale-merchant', name: 'Tobble', title: 'Stallkeeper of the Vale', weapon: 'sword',
    model: 'goblin', accent: PALETTE.witch,
    lines: ['Dragon scales, genuine, shed this morning. Do not ask how I know.', 'Lantern oil! Rope! Things that look like rope!'],
    behaviour: { kind: 'stand', pose: 'offer', yaw: Math.PI },
    shop: [{ itemId: 'moon-dew', price: 30 }, { itemId: 'lotus-tea', price: 26 }],
  },
  // DeVj-Z8POjl: the diver walking the kelp road between the jellyfish lanterns.
  {
    id: 'diver', name: 'The Diver', title: 'Who Walks the Kelp Road', weapon: 'staff',
    model: 'diver', accent: PALETTE.rune,
    lines: ['The helmet stays on. I do not remember the air well enough to miss it.', 'The jellyfish lanterns go out if you stare at them. Do not stare.', 'Up the street, past the fish, the Fish King pours.'],
    behaviour: { kind: 'loop', path: [[-1000.8, 50], [-999.4, 36], [-1000.6, 24], [-999.4, 36]], speed: 0.8 },
  },
  {
    id: 'fish-king', name: 'The Fish King', title: 'Host of the Sea Castle', weapon: 'staff',
    model: 'fish-king', accent: PALETTE.rune,
    lines: ['Welcome under the lake. Breathe if you like; it changes nothing down here.', 'The jellyfish are the lamps. The lamps are rude.', 'Drink from the purple chalice. Forty shards, and you will float a little.'],
    behaviour: { kind: 'stand', pose: 'offer', yaw: Math.PI / 2 },
    shop: [{ itemId: 'moon-dew', price: 40 }, { itemId: 'lotus-tea', price: 30 }],
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
  /** Sound hooks, set once by main.ts (NPCs never import the audio engine). */
  static sound: { voice(url: string, gain: number): Promise<number>; slurp(gain: number): void } | null = null;
  private bubble: SpeechBubble | null = null;
  private voiceWait = 4;
  private speaking = 0;
  private lastPhase = 0;
  private gone = false;
  /** A guard's moment: in the doorway, stepping aside, or stood aside. */
  private guard: 'block' | 'step' | 'aside' = 'block';
  /** Set by the world: the doorway is free (its barrier comes down). */
  onStepAside?: () => void;
  /** Out of the world for now (Croak in the sack, Yung Lean off his throne to fight): not drawn, not talked to, silent. */
  get hidden(): boolean {
    return this.gone;
  }

  set hidden(v: boolean) {
    this.gone = v;
    this.object.visible = !v;
    // (World.showZone shows a zone's things again when the player returns; it leaves this one alone.)
    this.object.userData.hidden = v;
  }

  constructor(readonly def: NpcDef, start: { x: number; z: number }, private readonly heightAt: (x: number, z: number, y?: number) => number) {
    this.rig = new Rig({ id: def.id, name: def.name, title: def.title, element: 'fog', weapon: def.weapon, maxHp: 1, atk: 1, accent: def.accent }, def.model);
    this.object = this.rig.root;
    if (def.cup) this.rig.holdCup();
    if (def.scale && def.scale !== 1) this.object.scale.setScalar(def.scale);
    this.pos.set(start.x, heightAt(start.x, start.z), start.z);
    if (def.behaviour.kind === 'stand') this.yaw = def.behaviour.yaw;
    if (def.behaviour.kind === 'loop') {
      this.pos.set(def.behaviour.path[0][0], 0, def.behaviour.path[0][1]);
      this.pos.y = heightAt(this.pos.x, this.pos.z);
    }
    if (def.voice) this.voiceWait = def.voice.firstAfter ?? this.voiceWait;
    // A guard speaks his line too (as he steps aside), so he gets a bubble even without a voice of his own.
    if (def.voice || def.behaviour.kind === 'guard') {
      this.bubble = new SpeechBubble((MODELS[def.model]?.height ?? 1.8) + 0.55);
      this.object.add(this.bubble.sprite);
    }
  }

  /** Says the voice line now (also used when the player opens a conversation). */
  speak(gain = 1): void {
    const v = this.def.voice;
    if (!v || this.speaking > 0) return;
    this.speaking = 2.6;
    this.voiceWait = v.every;
    this.bubble?.say(v.caption, 2.4);
    void Npc.sound?.voice(v.url, gain);
  }

  /** Voice lines and sips for NPCs that have them; `d` is the distance to the player. */
  private sounds(dt: number, d: number): void {
    const v = this.def.voice;
    this.bubble?.update(dt);
    if (this.speaking > 0) this.speaking -= dt;
    if (v) {
      this.voiceWait -= dt;
      // Speak between sips: once the cup is back down (end of the drink loop) and the pause has passed.
      if (this.voiceWait <= 0 && d < v.range && this.speaking <= 0 && (this.lastPhase > 0.8 || !this.rig.model)) this.speak(Math.max(0.15, 1 - d / v.range));
    }
    if (this.def.sipAt !== undefined && this.speaking <= 0 && this.rig.model) {
      const phase = this.rig.model.clipPhase;
      if (this.lastPhase < this.def.sipAt && phase >= this.def.sipAt && d < 16) Npc.sound?.slurp(Math.max(0.1, 1 - d / 16));
      this.lastPhase = phase;
    } else if (this.rig.model) this.lastPhase = this.rig.model.clipPhase;
  }

  /** Distance from the player at which the talk prompt appears. */
  get talkRange(): number {
    return 4.2 * (this.def.scale ?? 1) * Math.max(1, (MODELS[this.def.model]?.height ?? 1.8) / 1.8);
  }

  update(dt: number, player: Vector3, talking: boolean, animate = true): void {
    if (this.gone) return;
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
    } else if (b.kind === 'guard') {
      const d = Math.hypot(player.x - this.pos.x, player.z - this.pos.z);
      if (this.guard === 'block') {
        this.yaw = b.yaw;
        if (d < b.trigger) {
          this.guard = 'step';
          const v = VOICES[b.line];
          if (v) { this.bubble?.say(v.text, 3); this.speaking = 2.4; void Npc.sound?.voice(voiceUrl(b.line), 1); }
          this.onStepAside?.();
        }
      } else if (this.guard === 'step') {
        const dx = b.aside[0] - this.pos.x;
        const dz = b.aside[1] - this.pos.z;
        const dd = Math.hypot(dx, dz);
        if (dd < 0.1) { this.guard = 'aside'; }
        else {
          const step = Math.min(dd, 1.6 * dt);
          this.pos.x += (dx / dd) * step;
          this.pos.z += (dz / dd) * step;
          const target = Math.atan2(dz, dx);
          this.yaw += Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw)) * Math.min(1, dt * 6);
          moving = true;
          this.speed = 1.6;
        }
      } else this.yaw += Math.atan2(Math.sin(b.asideYaw - this.yaw), Math.cos(b.asideYaw - this.yaw)) * Math.min(1, dt * 4);
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
    if (moving) this.pos.y += (this.heightAt(this.pos.x, this.pos.z, this.pos.y) - this.pos.y) * Math.min(1, dt * 8);
    this.object.position.copy(this.pos);
    this.object.rotation.y = yawToRotation(this.yaw);
    this.sounds(dt, Math.hypot(player.x - this.pos.x, player.z - this.pos.z));
    const pose = b.kind === 'guard' && moving ? undefined : this.speaking > 0 ? 'talk' : talking ? (this.def.voice ? b.kind === 'stand' ? b.pose : undefined : undefined) : b.kind === 'stand' || b.kind === 'guard' || b.kind === 'loop' ? b.pose : undefined;
    if (animate) this.rig.animate({ mode: 'ground', speed: moving ? this.speed : 0, pose }, dt);
  }
}
