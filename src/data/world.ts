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
  flowerMeadows: [
    { x: 40, z: 70, r: 30, count: 320 },
    { x: -40, z: -20, r: 26, count: 260 },
    { x: 90, z: -120, r: 24, count: 220 },
  ],
  sunflowerFields: [
    { x: -70, z: 44, r: 28, count: 280 },
    { x: 74, z: 92, r: 22, count: 200 },
    { x: -72, z: -32, r: 16, count: 150 },
  ],
  frog: { x: -86, z: -54 },
  coven: { streamX: -112, zMin: -70, zMax: 80, bridgeZ: 15 },
  castle: { x: -165, z: -70 },
  orchard: { x: 100, z: 40 },
  rainZone: { x: 100, z: 40, radius: 45 },
  snowZone: { x: 120, z: -80, radius: 60 },
  frozenRect: { xFrom: 55, xTo: 190, zFrom: -175, zTo: -30 },
  colossusPath: [[165, -150], [178, -90], [172, -30], [160, 30], [140, 90], [150, 40], [165, -40], [170, -110]] as Array<[number, number]>,
  ruins: [
    { x: -14, z: 72, yaw: 0.3, arch: true }, { x: 15, z: 34, yaw: -0.4, arch: false }, { x: -15, z: -22, yaw: 0.9, arch: false },
    { x: 16, z: -150, yaw: 0.2, arch: true }, { x: 82, z: -62, yaw: 1.1, arch: true }, { x: 96, z: -98, yaw: -0.7, arch: false },
    { x: -40, z: 100, yaw: 0.5, arch: false }, { x: 60, z: -130, yaw: 0.0, arch: false },
  ],
  waterfalls: [
    { x: -34, z: -74, width: 9, height: 72 },
    { x: 38, z: -116, width: 7, height: 72 },
  ],
  cloudSea: { y: -26 },
} as const;
