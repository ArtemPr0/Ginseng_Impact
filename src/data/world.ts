/** Placement of everything in the first area. Units are metres; the causeway runs north (−z) along x = 0. */
export const LAYOUT = {
  spawn: { x: 0, z: 59 },
  causeway: { x: 0, zStart: 62, zEnd: -115, width: 6, yStart: 6, yEnd: 11, postSpacing: 8, segmentLength: 24.7 },
  head: { x: 0, z: -139, height: 52 },
  cathedral: { x: 76, z: -28 },
  monoliths: [
    [-9, 65, 2.2, 6, 2.2, 0.2], [9, 62, 2.6, 9, 2.4, -0.3], [-16, 55, 3, 13, 3, 0.5],
    [20, 24, 3.5, 16, 3.2, 0.9], [-26, 11, 2.8, 11, 2.8, 0.1], [31, -13, 4, 22, 3.6, -0.6],
    [-36, -90, 3, 14, 3, 0.4], [42, -96, 2.5, 9, 2.5, 1.1], [-60, 36, 3.4, 17, 3, -0.2],
  ] as const,
  forest: { innerRadius: 72, outerRadius: 119, count: 420 },
  flowerMeadows: [
    { x: 24, z: 42, r: 20, count: 220 },
    { x: -24, z: -12, r: 17, count: 180 },
    { x: 54, z: -72, r: 16, count: 150 },
  ],
  sunflowerFields: [
    { x: -42, z: 26, r: 19, count: 190 },
    { x: 44, z: 55, r: 15, count: 140 },
    { x: -43, z: -19, r: 11, count: 100 },
  ],
  frog: { x: -52, z: -32 },
  coven: { streamX: -67, zMin: -42, zMax: 48, bridgeZ: 9 },
  castle: { x: -99, z: -42 },
  orchard: { x: 60, z: 24 },
  rainZone: { x: 60, z: 24, radius: 30 },
  snowZone: { x: 72, z: -48, radius: 40 },
  frozenRect: { xFrom: 33, xTo: 114, zFrom: -105, zTo: -18 },
  colossusPath: [[99, -90], [107, -54], [103, -18], [96, 18], [84, 54], [90, 24], [99, -24], [102, -66]] as Array<[number, number]>,
  ruins: [
    { x: -8, z: 43, yaw: 0.3, arch: true }, { x: 9, z: 20, yaw: -0.4, arch: false }, { x: -9, z: -13, yaw: 0.9, arch: false },
    { x: 10, z: -90, yaw: 0.2, arch: true }, { x: 49, z: -37, yaw: 1.1, arch: true }, { x: 58, z: -59, yaw: -0.7, arch: false },
    { x: -24, z: 60, yaw: 0.5, arch: false }, { x: 36, z: -78, yaw: 0.0, arch: false },
  ],
  waterfalls: [
    { x: -20, z: -44, width: 9, height: 72 },
    { x: 23, z: -70, width: 7, height: 72 },
  ],
  cloudSea: { y: -26 },
} as const;
