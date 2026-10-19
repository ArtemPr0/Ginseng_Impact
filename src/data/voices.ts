/**
 * Spoken lines, rendered to public/audio/<id>.mp3 by scripts/voices.mjs (macOS `say` + ffmpeg). The same text is the
 * caption. `voice` is a `say -v` name, `rate` words per minute, `pitch` a playback-rate factor (pitch and formants,
 * tempo kept), `fx` an extra ffmpeg filter chain. No imports: the script reads this file directly.
 */
export interface VoiceLine { text: string; voice: string; rate: number; pitch: number; fx?: string }

/** A cavernous stone voice: low, slow, with a long echo. */
const STONE = 'lowpass=f=2400,aecho=0.8:0.88:140|290:0.35|0.22';
/** A royal hall: a little room. */
const HALL = 'aecho=0.8:0.7:60:0.18';
/** Frogs: a throaty wobble. */
const CROAK = 'vibrato=f=11:d=0.25';
/** Yung Lean's hall: soft, wide, a long tail. */
const LEAN = 'aecho=0.7:0.6:180|360:0.25|0.15,lowpass=f=6500';
/** Autotune-ish: a fast stepped vibrato, a phaser shimmer and a short slap. */
const TUNE = 'vibrato=f=7:d=0.35,aphaser=type=t:speed=2:decay=0.5,aecho=0.6:0.5:40:0.2';

export const VOICES: Record<string, VoiceLine> = {
  // The giant stone head on the north cliff.
  'head-doing-here': { text: 'What are you doing here?', voice: 'Ralph', rate: 120, pitch: 0.62, fx: STONE },
  'head-blocking': { text: "You're blocking my view!", voice: 'Ralph', rate: 125, pitch: 0.62, fx: STONE },
  // The Antlered King on his throne.
  'king-ask': { text: 'The Warden. My own antlered warden has taken my castle, and the throne within it. Kill it, and I will reward you... very generously.', voice: 'Daniel', rate: 150, pitch: 0.84, fx: HALL },
  'king-wait': { text: 'The Warden still breathes. I can hear it chewing my furniture.', voice: 'Daniel', rate: 155, pitch: 0.84, fx: HALL },
  'king-thanks': { text: 'It is dead? Then the castle is mine again. Take it, all of it. I said generously, and I meant it.', voice: 'Daniel', rate: 150, pitch: 0.84, fx: HALL },
  // Goldgrin, the gnome of the purple cup, between sips (its file predates this table: the Grandpa voice up into a gnome, as measured).
  'where-is-young-lean': { text: 'Where is Young Lean?', voice: 'Grandpa (English (UK))', rate: 130, pitch: 1.25 },
  // Goldgrin's brother, inside the tree house.
  'brother-greet': { text: 'Yo. You know my brother Goldgrin? Always asking where Yung Lean is. Find him, get a cup signed, bring it here. I pay good. Diamond-grill good.', voice: 'Eddy (English (US))', rate: 185, pitch: 1.18 },
  'brother-wait': { text: 'No cup, no shards. Yung Lean is somewhere past the portal. Sad, and rich.', voice: 'Eddy (English (US))', rate: 185, pitch: 1.18 },
  'brother-paid': { text: "Bro. That's his real signature. Here. Don't spend it all on cups.", voice: 'Eddy (English (US))', rate: 180, pitch: 1.18 },
  // The Frog King and his son.
  'frog-ask': { text: "My son Croak has wandered off again. Find him, stranger. He might be dealing things he shouldn't be... again.", voice: 'Grandpa (English (UK))', rate: 150, pitch: 0.82, fx: CROAK },
  'frog-wait': { text: 'Croak is still out there. Try the shady places. He likes the shady places.', voice: 'Grandpa (English (UK))', rate: 150, pitch: 0.82, fx: CROAK },
  'frog-reward': { text: 'My boy, home in a sack! You have my thanks, stranger. As a sign of respect... you may lick me.', voice: 'Grandpa (English (UK))', rate: 145, pitch: 0.82, fx: CROAK },
  'frog-declined': { text: 'Suit yourself. Here, take some shards instead.', voice: 'Grandpa (English (UK))', rate: 150, pitch: 0.82, fx: CROAK },
  'frog-licked': { text: 'Hold still. This will only take about four minutes.', voice: 'Grandpa (English (UK))', rate: 140, pitch: 0.82, fx: CROAK },
  'frog-anytime': { text: 'Ah, my friend. You can lick me any time you want.', voice: 'Grandpa (English (UK))', rate: 145, pitch: 0.82, fx: CROAK },
  'croak-busted': { text: "Ribbit. Whatever my dad told you, it's not mine.", voice: 'Junior', rate: 190, pitch: 1.2, fx: CROAK },
  'croak-bagged': { text: 'Hey! Hey! Not the sack again!', voice: 'Junior', rate: 200, pitch: 1.25, fx: CROAK },
  // The rowers on the river boats.
  'rower-offer': { text: 'Oi! Fancy a free beer, friend? Brewed it ourselves, under the bench.', voice: 'Daniel', rate: 175, pitch: 0.95 },
  'rower-sober': { text: 'More for us, then!', voice: 'Reed (English (UK))', rate: 175, pitch: 0.9 },
  'rower-wife': { text: 'Ha! Mine already did. Twice.', voice: 'Reed (English (UK))', rate: 170, pitch: 0.9 },
  'rower-yeah': { text: "That's the spirit! Drink up. You'll row forever.", voice: 'Daniel', rate: 175, pitch: 0.95 },
  // Dunmar, the knight at the door of Yung Lean's hall, stepping aside (the user's line, verbatim).
  'guard-cool': { text: "I didn't know you were chill like that.", voice: 'Daniel', rate: 160, pitch: 0.86, fx: HALL },
  // Yung Lean on his porcelain throne: slow, monotone, a little melancholy, Swedish (the user's lines, verbatim).
  'lean-greet': { text: 'Welcome to the palace. Keep your boots clean, the porcelain cracks easily... What brings you to the sad side of the world?', voice: 'Alva', rate: 128, pitch: 0.93, fx: LEAN },
  'lean-quest': { text: 'The world is getting quiet, stranger. The silence is creeping into the neon valleys. Take this blade, go into the mist, and bring back the sound.', voice: 'Alva', rate: 125, pitch: 0.93, fx: LEAN },
  'lean-warlord': { text: "Chaos follows me like a shadow. You think you know pain? I've been in the abyss since 2002. Shield your eyes, the digital snow is coming!", voice: 'Alva', rate: 135, pitch: 0.93, fx: LEAN },
  'lean-idle': { text: 'Bittersweet... everything is bittersweet. Do you happen to have any iced tea on you? No? Shame.', voice: 'Alva', rate: 120, pitch: 0.93, fx: LEAN },
  'lean-sound': { text: "You found it. Listen... the snow is singing again. Here. Sign it? Sure. I sign everything. It's all the same cup.", voice: 'Alva', rate: 125, pitch: 0.93, fx: LEAN },
  'lean-beaten': { text: 'Okay. Okay. The throne is still mine. You just... borrowed the moment.', voice: 'Alva', rate: 120, pitch: 0.93, fx: LEAN },
  // The Styro-Ghouls: high-pitched, autotuned (a stepped vibrato and a metallic shimmer).
  'ghoul-aggro-1': { text: 'A stranger in the mist! Quick, splash em!', voice: 'Junior', rate: 200, pitch: 1.55, fx: TUNE },
  'ghoul-aggro-2': { text: 'Sip this, outsider!', voice: 'Junior', rate: 190, pitch: 1.6, fx: TUNE },
  'ghoul-attack-1': { text: 'Double cup, double trouble!', voice: 'Junior', rate: 200, pitch: 1.55, fx: TUNE },
  'ghoul-attack-2': { text: 'Watch the drip!', voice: 'Junior', rate: 200, pitch: 1.6, fx: TUNE },
  'ghoul-attack-3': { text: 'Stay codeine cold!', voice: 'Junior', rate: 195, pitch: 1.55, fx: TUNE },
  'ghoul-win-1': { text: 'Too slow for the kingdom...', voice: 'Junior', rate: 180, pitch: 1.5, fx: TUNE },
  'ghoul-win-2': { text: 'Drowned in the sauce!', voice: 'Junior', rate: 190, pitch: 1.55, fx: TUNE },
  'ghoul-death-1': { text: 'The cup... is empty...', voice: 'Junior', rate: 150, pitch: 1.4, fx: TUNE + ',atempo=0.85' },
  'ghoul-death-2': { text: 'Spilled... the whole thing...', voice: 'Junior', rate: 150, pitch: 1.4, fx: TUNE + ',atempo=0.85' },
};

/** URL of a rendered line. */
export const voiceUrl = (id: string): string => `/audio/${id}.mp3`;
