/**
 * Where to set down something `r` wide near (x, z) so all of it rests on the ground (a chest's coin block sat on a
 * post's top on the Vale castle's shelf, overhanging it on every side: the playtest of 2026-11-12): the spot itself
 * if the ground across its footprint is level (within 0.25 m), else the nearest level spot within `maxShift`, searched
 * in rings; failing that, the spot as given.
 */
export function levelSpot(heightAt: (x: number, z: number) => number, x: number, z: number, r: number, maxShift: number): { x: number; z: number; y: number } {
  const level = (px: number, pz: number): number | null => {
    const hs = [heightAt(px, pz)];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; hs.push(heightAt(px + Math.cos(a) * r, pz + Math.sin(a) * r)); }
    return Math.max(...hs) - Math.min(...hs) <= 0.25 ? hs[0] : null;
  };
  const here = level(x, z);
  if (here !== null) return { x, z, y: here };
  for (let d = 0.5; d <= maxShift + 1e-9; d += 0.5) {
    const n = Math.max(8, Math.round(d * 8));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      const y = level(px, pz);
      if (y !== null) return { x: px, z: pz, y };
    }
  }
  return { x, z, y: heightAt(x, z) };
}
