import { describe, expect, it } from 'vitest';
import { COURT_DRAGONS, COURT_RUIN, ruinPieces } from './Pois';

describe('the Skeleton Court\'s fallen gatehouse', () => {
  it('leaves the throne dragons room: no column or wall in a dragon\'s claws', () => {
    const { columns, walls } = ruinPieces(COURT_RUIN.x, COURT_RUIN.z, COURT_RUIN.yaw, COURT_DRAGONS);
    for (const [x, z] of [...columns, ...walls]) for (const [dx, dz, r] of COURT_DRAGONS) expect(Math.hypot(x - dx, z - dz)).toBeGreaterThanOrEqual(r);
    expect(columns.length + walls.length).toBeGreaterThanOrEqual(4);
  });
  it('without anything to avoid, lays all four columns and both walls', () => {
    const { columns, walls } = ruinPieces(0, 0, 0);
    expect([columns.length, walls.length]).toEqual([4, 2]);
  });
});
