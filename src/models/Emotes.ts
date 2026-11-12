/**
 * Emotes every Meshy biped shares (the playtest of 2026-11-12: "better NPC interactions ... make it hilarious"):
 * Meshy presets added to one rig and exported once (2026-11-12, the Vale Knight's rig: Cheer_with_Both_Hands_Up,
 * Wave_One_Hand, FunnyDancing_01, ymca_dance, Shrug, Angry_Stomp, jumping_jacks, Sitting_Clap), each cut to its own
 * rotation-only file (model-tools clip --rot-only). Every Meshy biped rig has the same skeleton, so any of them can
 * play these (the shared sit clip, npc-sit.glb, works the same way).
 */
export const EMOTE_FILES: Readonly<Record<string, string>> = {
  cheer: 'npc-cheer.glb', wave: 'npc-wave.glb', dance: 'npc-dance.glb', ymca: 'npc-ymca.glb',
  shrug: 'npc-shrug.glb', stomp: 'npc-stomp.glb', jacks: 'npc-jacks.glb', clap: 'npc-clap.glb',
};

/** The emote files a model gets: all of them for a Meshy biped (it has the rig's Walking clip), minus its own. */
export function emotesFor(def: { clipFiles?: Partial<Record<string, string>>; emotes?: boolean }, clipNames: readonly string[]): Record<string, string> {
  if (def.emotes === false || !clipNames.some((n) => /^walking$/i.test(n))) return {};
  const out: Record<string, string> = {};
  for (const [k, f] of Object.entries(EMOTE_FILES)) if (!def.clipFiles?.[k]) out[k] = f;
  return out;
}

export type Moment = 'kill' | 'boss' | 'wipe' | 'wave' | 'levelup' | 'bored';

const KILL = ['cheer', 'dance', 'ymca', 'jacks'];

/**
 * What a bystander does at a moment: cheers or dances at a kill nearby, the YMCA for a boss, a shrug when the party
 * falls, a wave hello, a cheer for a level. Seated bodies clap from the seat or keep still (a standing clip on a seated
 * NPC would lift it off its chair).
 */
export function reactionFor(moment: Moment, seated: boolean, rand: () => number = Math.random): { key: string; seconds: number } | null {
  if (seated) return moment === 'wave' || moment === 'bored' ? null : { key: 'clap', seconds: 3 };
  switch (moment) {
    case 'kill': return { key: KILL[Math.min(KILL.length - 1, Math.floor(rand() * KILL.length))], seconds: 3 };
    case 'boss': return { key: 'ymca', seconds: 7 };
    case 'wipe': return { key: 'shrug', seconds: 2.5 };
    case 'wave': return { key: 'wave', seconds: 2.2 };
    case 'levelup': return { key: 'cheer', seconds: 3 };
    case 'bored': return rand() < 0.5 ? { key: 'dance', seconds: 4 } : { key: 'jacks', seconds: 3 };
  }
}
