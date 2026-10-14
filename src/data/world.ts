/** Placement of everything in the first area. Units are metres; the causeway runs north (−z) along x = 0. */
export const LAYOUT = {
  spawn: { x: 0, z: 98 },
  causeway: { x: 0, zStart: 104, zEnd: -192, width: 6, yStart: 6, yEnd: 11, postSpacing: 8, segmentLength: 24.7 },
  head: { x: 0, z: -232, height: 52 },
  cathedral: { x: 126, z: -46 },
  monoliths: [
    [-9, 108, 2.2, 6, 2.2, 0.2], [9, 104, 2.6, 9, 2.4, -0.3], [-16, 92, 3, 13, 3, 0.5],
    [34, 40, 3.5, 16, 3.2, 0.9], [-44, 18, 2.8, 11, 2.8, 0.1], [52, -22, 4, 22, 3.6, -0.6],
    [-60, -150, 3, 14, 3, 0.4], [70, -160, 2.5, 9, 2.5, 1.1], [-100, 60, 3.4, 17, 3, -0.2],
  ] as const,
  forest: { innerRadius: 120, outerRadius: 198, count: 650 },
  sunflowerFields: [
    { x: -70, z: 44, r: 28, count: 280 },
    { x: 74, z: 92, r: 22, count: 200 },
    { x: -92, z: -36, r: 18, count: 150 },
  ],
  waterfalls: [
    { x: -34, z: -74, width: 9, height: 72 },
    { x: 38, z: -116, width: 7, height: 72 },
  ],
  cloudSea: { y: -26 },
} as const;
