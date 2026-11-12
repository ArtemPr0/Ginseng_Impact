/**
 * Which locomotion clip a body plays at ground speed `v`: the one whose natural pace (`rate`, m/s at speed 1) is
 * nearest in log terms, played at the speed that matches it exactly. The gait it is already in is kept until another
 * is clearly nearer (by HOLD in log terms): a body moving between two paces would otherwise flip gait every frame,
 * and each flip restarts the clip, so the legs never get past their first frame (the Galaxy Knight, 2026-11-12).
 */
const HOLD = 0.25;

export function pickGait(rates: ReadonlyArray<{ key: string; rate: number }>, v: number, current: string): { key: string; scale: number } | null {
  let best: { key: string; scale: number; err: number } | null = null;
  let held: { key: string; scale: number; err: number } | null = null;
  for (const { key, rate } of rates) {
    if (rate <= 0) continue;
    const scale = v / rate;
    const err = Math.abs(Math.log(scale));
    if (!best || err < best.err) best = { key, scale, err };
    if (key === current) held = { key, scale, err };
  }
  if (!best) return null;
  const pick = held && held.err - best.err < HOLD ? held : best;
  return { key: pick.key, scale: pick.scale };
}
