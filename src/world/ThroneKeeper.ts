/**
 * Sir Bonesworth, the skeleton keeping the castle hall's throne warm (the playtest of 2026-11-14: the hall was "just a
 * big crown on top of empty throne ... add something hilarious and funny to surprise the player"). He sits in it wearing
 * the lost crown, far too big for him; ask him for the throne and he refuses, twice, then throws the crown at you. Sit
 * in it crowned and it answers (CastleHall: a whoopee cushion and a launch, the moon laughing). Leave and he takes the
 * crown back; the next time he gives it up at once.
 */
export type CrownAt = 'keeper' | 'hero';

const REFUSALS = [
  'Occupied.',
  "Four hundred years I've kept it warm. My legs fell asleep. Then they fell off.",
];
const GIVE = 'FINE. Take the hat. It itches. I have no hair and it STILL itches.';
const GIVE_AGAIN = 'You again. Fine. Take it. Wash it this time.';
const SITS = [
  'The throne remembers its king. Loudly.',
  'Every king gets that. Every single one.',
  'It does that. We do not talk about it.',
];

export class ThroneKeeper {
  crown: CrownAt = 'keeper';
  private asked = 0;
  private given = false;
  private sat = 0;

  /** What pressing F at the throne does now. */
  prompt(): string {
    return this.crown === 'keeper' ? 'Ask the skeleton for the throne' : 'Sit on the throne';
  }

  /** Asking for the throne: an excuse, or the crown (`give`). */
  ask(): { line: string; give: boolean } {
    if (this.crown === 'hero') return { line: SITS[0], give: false };
    if (this.given) { this.crown = 'hero'; return { line: GIVE_AGAIN, give: true }; }
    const line = REFUSALS[this.asked];
    this.asked++;
    if (line !== undefined) return { line, give: false };
    this.crown = 'hero';
    this.given = true;
    return { line: GIVE, give: true };
  }

  /** Sitting down: only a crowned hero may; the keeper comments every time. */
  sit(): { ok: boolean; line: string } {
    if (this.crown !== 'hero') return { ok: false, line: REFUSALS[0] };
    const line = SITS[this.sat % SITS.length];
    this.sat++;
    return { ok: true, line };
  }

  /** The hero left the hall: the keeper has his crown back. */
  leave(): void {
    this.crown = 'keeper';
  }
}
