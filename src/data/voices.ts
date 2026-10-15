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

export const VOICES: Record<string, VoiceLine> = {
  // The giant stone head on the north cliff.
  'head-doing-here': { text: 'What are you doing here?', voice: 'Ralph', rate: 120, pitch: 0.62, fx: STONE },
  'head-blocking': { text: "You're blocking my view!", voice: 'Ralph', rate: 125, pitch: 0.62, fx: STONE },
  // The Antlered King on his throne.
  'king-ask': { text: 'The Warden. My own antlered warden has taken my castle, and the throne within it. Kill it, and I will reward you... very generously.', voice: 'Daniel', rate: 150, pitch: 0.84, fx: HALL },
  'king-wait': { text: 'The Warden still breathes. I can hear it chewing my furniture.', voice: 'Daniel', rate: 155, pitch: 0.84, fx: HALL },
  'king-thanks': { text: 'It is dead? Then the castle is mine again. Take it, all of it. I said generously, and I meant it.', voice: 'Daniel', rate: 150, pitch: 0.84, fx: HALL },
  // Goldgrin's brother, inside the tree house.
  'brother-greet': { text: 'Yo. You know my brother Goldgrin? Always asking where Yung Lean is. Find him, get a cup signed, bring it here. I pay good. Diamond-grill good.', voice: 'Eddy (English (US))', rate: 185, pitch: 1.18 },
  'brother-wait': { text: 'No cup, no shards. Yung Lean is somewhere past the portal. Sad, and rich.', voice: 'Eddy (English (US))', rate: 185, pitch: 1.18 },
  'brother-paid': { text: "Bro. That's his real signature. Here. Don't spend it all on cups.", voice: 'Eddy (English (US))', rate: 180, pitch: 1.18 },
  // The Frog King and his son.
  'frog-ask': { text: "My son Croak has wandered off again. Find him, stranger. He might be dealing things he shouldn't be... again.", voice: 'Grandpa (English (UK))', rate: 150, pitch: 0.82, fx: CROAK },
  'frog-wait': { text: 'Croak is still out there. Try the shady places. He likes the shady places.', voice: 'Grandpa (English (UK))', rate: 150, pitch: 0.82, fx: CROAK },
  'frog-reward': { text: 'My boy, home in a sack! You have my thanks, stranger. As a sign of respect... you may lick me.', voice: 'Grandpa (English (UK))', rate: 145, pitch: 0.82, fx: CROAK },
  'frog-declined': { text: 'Suit yourself. Here, take some shards instead.', voice: 'Grandpa (English (UK))', rate: 150, pitch: 0.82, fx: CROAK },
  'frog-licked': { text: 'Hold still. This will only take about two minutes.', voice: 'Grandpa (English (UK))', rate: 140, pitch: 0.82, fx: CROAK },
  'croak-busted': { text: "Ribbit. Whatever my dad told you, it's not mine.", voice: 'Junior', rate: 190, pitch: 1.2, fx: CROAK },
  'croak-bagged': { text: 'Hey! Hey! Not the sack again!', voice: 'Junior', rate: 200, pitch: 1.25, fx: CROAK },
  // The rowers on the river boats.
  'rower-offer': { text: 'Oi! Fancy a free beer, friend? Brewed it ourselves, under the bench.', voice: 'Daniel', rate: 175, pitch: 0.95 },
  'rower-sober': { text: 'More for us, then!', voice: 'Reed (English (UK))', rate: 175, pitch: 0.9 },
  'rower-wife': { text: 'Ha! Mine already did. Twice.', voice: 'Reed (English (UK))', rate: 170, pitch: 0.9 },
  'rower-yeah': { text: "That's the spirit! Drink up. You'll row forever.", voice: 'Daniel', rate: 175, pitch: 0.95 },
};

/** URL of a rendered line. */
export const voiceUrl = (id: string): string => `/audio/${id}.mp3`;
