import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { Breakables, breakHp, canBreak, collapseDelay, POWER, rebuildDue, trimGrid, unheld, type BreakTarget } from './Breakables';
import { HeightWorld, type GridFootprint } from './Colliders';
import { blockCount, chunkCount } from './Fracture';

function grid(): GridFootprint {
  // 4 x 4 cells of 1 m, centred on (10, 10), all solid 6 m tall (unit 0.1 → top 60).
  const data = new Uint8Array(16 * 3);
  for (let c = 0; c < 16; c++) { data[c * 3] = 0; data[c * 3 + 1] = 255; data[c * 3 + 2] = 60; }
  return { kind: 'grid', id: 'test', x: 10, z: 10, rotY: 0, base: 0, minX: -2, minZ: -2, cell: 1, nx: 4, nz: 4, unit: 0.1, data, r: 3, top: 6 };
}

describe('hit points and power', () => {
  it('props break in one light blow; a house takes about six heavies or two spells; a cathedral needs bursts', () => {
    expect(breakHp(1)).toBeLessThanOrEqual(POWER.light);
    expect(breakHp(8) / POWER.heavy).toBeGreaterThanOrEqual(5);
    expect(breakHp(8) / POWER.heavy).toBeLessThanOrEqual(7);
    expect(Math.ceil(breakHp(8) / POWER.spell)).toBe(2);
    expect(breakHp(50) / POWER.burst).toBeGreaterThanOrEqual(3);
  });

  it('light combo hits only break props', () => {
    expect(canBreak(1, 'light')).toBe(true);
    expect(canBreak(8, 'light')).toBe(false);
    expect(canBreak(8, 'heavy')).toBe(true);
  });
});

describe('unheld', () => {
  it('a chunk joined to the ground through standing neighbours stands; a tower blown through the middle drops its top', () => {
    // 0-1-2-3-4 stacked, 0 on the ground.
    const adj = [[1], [0, 2], [1, 3], [2, 4], [3]];
    const ground = [true, false, false, false, false];
    expect(unheld(adj, [true, true, false, true, true], ground).sort()).toEqual([3, 4]);
    expect(unheld(adj, [true, true, true, true, true], ground)).toEqual([]);
  });

  it('a wall held up from the side still stands', () => {
    // 0 1 on the ground, 3 over 0, 2 over 1; 0 gone, 3 hangs on 2.
    const adj = [[1, 3], [0, 2], [1, 3], [0, 2]];
    expect(unheld(adj, [false, true, true, true], [true, true, false, false])).toEqual([]);
  });
});

describe('collapseDelay', () => {
  it('the walls by the blow go first, the far side last, within a second and a half for a big hall', () => {
    expect(collapseDelay(0, 6, 0.5)).toBeLessThan(collapseDelay(6, 6, 0.5));
    expect(collapseDelay(12, 50, 0.5)).toBeLessThanOrEqual(1.6);
    expect(collapseDelay(0, 6, 0.5)).toBeGreaterThanOrEqual(0);
  });
});

describe('trimGrid', () => {
  it('clears cells with nothing standing over them and lowers the rest to what stands, leaving the shared grid alone', () => {
    const f = grid();
    const before = f.data.slice();
    // One chunk left, over the cell at local (-1.5, -1.5), its top 2 m up.
    const t = trimGrid(f, [{ x: -1.5, y: 1.5, z: -1.5, r: 0.5 }]);
    expect(f.data).toEqual(before);
    const cell = (i: number, k: number) => t.data[(k * 4 + i) * 3 + 2];
    expect(cell(0, 0)).toBe(20);
    expect(cell(3, 3)).toBe(0);
  });
});

describe('rebuildDue', () => {
  it('waits its time, then rebuilds only out of the hero\'s sight and at least REBUILD_AWAY off', () => {
    expect(rebuildDue({ brokeAt: 0, quick: true }, 30, 200, false)).toBe(false);
    expect(rebuildDue({ brokeAt: 0, quick: true }, 61, 200, false)).toBe(true);
    expect(rebuildDue({ brokeAt: 0, quick: true }, 61, 20, false)).toBe(false);
    expect(rebuildDue({ brokeAt: 0, quick: true }, 61, 70, true)).toBe(false);
    expect(rebuildDue({ brokeAt: 0, quick: false }, 120, 200, false)).toBe(false);
    expect(rebuildDue({ brokeAt: 0, quick: false }, 181, 200, false)).toBe(true);
  });
});

function house(): { target: BreakTarget; root: Group } {
  const root = new Group();
  root.position.set(10, 0, 10);
  const mesh = new Mesh(new BoxGeometry(4, 6, 4, 6, 8, 6), new MeshStandardMaterial());
  mesh.position.y = 3;
  root.add(mesh);
  const parent = new Group();
  parent.add(root);
  return { root, target: { id: 'house', object: root, footprints: [grid()], size: 6 } };
}

function world() {
  const added: unknown[] = [];
  const heights = {
    added,
    add: (...f: unknown[]) => { added.push(...f); },
    remove: (...f: unknown[]) => { for (const x of f) { const i = added.indexOf(x); if (i >= 0) added.splice(i, 1); } },
    heightAt: () => 0,
  };
  return heights;
}

describe('Breakables', () => {
  it('a blow on a house knocks out the chunks near it and trims its collider', () => {
    const h = world();
    const b = new Breakables(h);
    const { target, root } = house();
    h.add(...target.footprints);
    b.register(target);
    b.damageAt(10, 1, 12, 1.5, 'spell');
    const e = b.entries[0];
    expect(e.state).toBe('broken');
    expect(root.visible).toBe(false);
    expect(b.sim.pieces.length).toBeGreaterThan(0);
    expect(h.added).not.toContain(target.footprints[0]);
    expect(h.added.length).toBe(1);
  });

  it('comes down when a blow takes nearly all of it: the collider goes at once, the rest falls one after another', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    h.add(...target.footprints);
    b.register(target);
    const before = b.sim.pieces.length;
    // (v13: hit points no longer bring a building down; a blow reaching 92 % of its blocks leaves too little standing.)
    b.damageAt(10, 2.4, 10, 3.2, 'burst');
    expect(b.entries[0].state).toBe('rubble');
    expect(h.added.length).toBe(0);
    // (What the blow left with nothing under it falls at once; anything still standing gives way in the wave.)
    for (let t = 0; t < 2; t += 0.05) b.update(0.05, { x: 0, z: 0 });
    expect(b.entries[0].chunks.every((c) => !c.standing)).toBe(true);
    void before;
  });

  it('a chunk that loses what held it up drops: it is not thrown away from the blow', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    h.add(...target.footprints);
    b.register(target);
    // Knock out the bottom of one side; what stood on it falls.
    b.damageAt(10, 0.5, 12, 2.2, 'skill');
    const e = b.entries[0];
    const dropped = e.chunks.filter((c) => !c.standing && c.piece && c.fell);
    for (const c of dropped) expect(Math.hypot(c.piece!.vx, c.piece!.vz)).toBeLessThan(1.2);
  });

  it('rubble at rest is solid: a box collider on each big piece, as high as the piece', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    h.add(...target.footprints);
    b.register(target);
    // (v13: buildings only lose what a blow reaches; one that reaches it all brings it down.)
    for (let i = 0; i < 3; i++) b.damageAt(10, 3, 10, 6, 'burst');
    for (let t = 0; t < 12; t += 0.05) b.update(0.05, { x: 0, z: 0 });
    const boxes = h.added.filter((f) => (f as { kind: string }).kind === 'box') as Array<{ top: number; x: number; z: number }>;
    expect(boxes.length).toBeGreaterThan(0);
    for (const f of boxes) {
      const p = b.sim.pieces.find((q) => Math.abs(q.x - f.x) < 1e-6 && Math.abs(q.z - f.z) < 1e-6)!;
      expect(p).toBeTruthy();
      expect(f.top).toBeGreaterThan(p.y - 0.01);
      expect(f.top).toBeLessThan(p.y + p.r + 0.01);
    }
  });

  it('a light blow on a house does nothing', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    b.register(target);
    b.damageAt(10, 1, 12, 1.5, 'light');
    expect(b.entries[0].state).toBe('intact');
  });

  it('rebuilds after its time when the hero is away: the model and collider come back, the rubble goes', () => {
    const h = world();
    const b = new Breakables(h);
    const { target, root } = house();
    h.add(...target.footprints);
    b.register(target);
    // (v13: buildings only lose what a blow reaches; one that reaches it all brings it down.)
    for (let i = 0; i < 3; i++) b.damageAt(10, 3, 10, 6, 'burst');
    for (let t = 0; t < 200; t += 0.5) b.update(0.5, { x: 300, z: 300 }, () => false);
    expect(b.entries[0].state).toBe('intact');
    expect(root.visible).toBe(true);
    expect(h.added).toContain(target.footprints[0]);
    expect(b.sim.pieces.length).toBe(0);
  });

  it('calls back when a building that houses someone comes down', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    let fell = 0;
    b.onCollapse = () => { fell++; };
    b.register({ ...target, quick: true });
    // (v13: buildings only lose what a blow reaches; one that reaches it all brings it down.)
    for (let i = 0; i < 3; i++) b.damageAt(10, 3, 10, 6, 'burst');
    expect(fell).toBe(1);
  });

  it('blows that waited for the cut collapse a building once, not once per blow (review 2026-11-16)', async () => {
    const { SyncFracturer } = await import('./FractureObject');
    const h = world();
    const b = new Breakables(h);
    const sync = new SyncFracturer();
    let ready = false;
    b.fracturer = { get: (...a) => (ready ? sync.get(...a) : null) };
    const { target } = house();
    let fell = 0;
    b.onCollapse = () => { fell++; };
    b.register({ ...target, quick: true });
    for (let i = 0; i < 4; i++) b.damageAt(10, 3, 10, 6, 'burst');
    expect(fell).toBe(0);
    ready = true;
    b.update(0.016, { x: 0, z: 0 });
    expect(fell).toBe(1);
  });
});

describe('blocks (v12: a house comes apart block by block, the reel\'s look)', () => {
  it('a stone house breaks into about blockCount(size) brick-sized blocks, drawn in a few batches', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    b.register(target);
    b.damageAt(10, 1, 12, 1.5, 'spell');
    const e = b.entries[0];
    expect(e.chunks.length).toBeGreaterThan(blockCount(6) * 0.6);
    expect(e.chunks.length).toBeLessThan(blockCount(6) * 1.6);
    expect(e.group!.children.filter((c) => (c as { isBatchedMesh?: boolean }).isBatchedMesh).length).toBe(2);
  });
  it('Low quality cuts fewer, bigger blocks', () => {
    const h = world();
    const b = new Breakables(h);
    b.blockScale = 0.4;
    const { target } = house();
    b.register(target);
    b.damageAt(10, 1, 12, 1.5, 'spell');
    expect(b.entries[0].chunks.length).toBeLessThan(blockCount(6) * 0.7);
  });
  it('a tree keeps its Voronoi logs', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    b.register({ ...target, id: 'tree', tree: true });
    b.damageAt(10, 1, 12, 1.5, 'spell');
    expect(b.entries[0].chunks.length).toBeLessThanOrEqual(chunkCount(6) + 2);
  });
});

describe('tear (v12: a vortex lifts a building away block by block, the reel\'s black hole)', () => {
  it('pulls loose a few standing blocks a call, the top ones first, without throwing them', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    h.add(...target.footprints);
    b.register(target);
    const n = b.tear(10, 10, 8, 5);
    expect(n).toBe(5);
    const e = b.entries[0];
    expect(e.state).toBe('broken');
    const gone = e.chunks.filter((c) => !c.standing);
    expect(gone).toHaveLength(5);
    const top = Math.max(...e.chunks.map((c) => c.y));
    for (const c of gone) expect(c.y).toBeGreaterThan(top - 1);
    for (const c of gone) expect(Math.hypot(c.piece!.vx, c.piece!.vz)).toBeLessThan(1.5);
  });
  it('out of reach: nothing; torn to the last third: it comes down', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    b.register(target);
    expect(b.tear(40, 40, 5, 5)).toBe(0);
    for (let i = 0; i < 200 && b.entries[0].state !== 'rubble'; i++) b.tear(10, 10, 8, 6);
    expect(b.entries[0].state).toBe('rubble');
  });
});

describe('rebuild and the zone (review 2026-11-16)', () => {
  it('a thing rebuilt while its place is not shown (the hero in a realm) stays hidden, and is no longer marked broken', () => {
    const h = world();
    const b = new Breakables(h);
    b.shownNow = () => false;
    const { target } = house();
    b.register({ ...target, quick: true });
    // (v13: buildings only lose what a blow reaches; one that reaches it all brings it down.)
    for (let i = 0; i < 3; i++) b.damageAt(10, 3, 10, 6, 'burst');
    expect(target.object.visible).toBe(false);
    for (let t = 0; t < 400; t += 1) b.update(1, { x: 500, z: 500 }, () => false);
    expect(b.entries[0].state).toBe('intact');
    expect(target.object.visible).toBe(false);
    expect(target.object.userData.hidden).toBeUndefined();
  });
});

describe('Breakables providers (instanced flora)', () => {
  it('registers a thing only when a blow reaches it, breaks it once, hides then shows it again', () => {
    const h = world();
    const b = new Breakables(h);
    const parent = new Group();
    let hidden = 0, shown = 0, asked = 0;
    const tree = (): BreakTarget => {
      const root = new Group();
      root.position.set(5, 0, 0);
      root.add(new Mesh(new BoxGeometry(0.6, 6, 0.6, 2, 8, 2), new MeshStandardMaterial()));
      return { id: 'pine', key: 'pine#3', object: root, parent, footprints: [], size: 2, hide: () => { hidden++; }, show: () => { shown++; } };
    };
    b.providers.push((x, z, r) => { asked++; return Math.hypot(x - 5, z) <= r + 1 ? [tree()] : []; });
    expect(b.entries.length).toBe(0);
    b.damageAt(5, 1, 0.5, 1, 'heavy');
    b.damageAt(5, 1, 0.5, 1, 'heavy');
    expect(asked).toBe(2);
    expect(b.entries.length).toBe(1);
    expect(b.entries[0].state).toBe('rubble');
    expect(hidden).toBe(1);
    for (let t = 0; t < 200; t += 0.5) b.update(0.5, { x: 300, z: 300 }, () => false);
    expect(shown).toBe(1);
  });

  it('a brief thing (a tree, a flower) leaves no solid rubble and its pieces are gone within ten seconds', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    b.register({ ...target, footprints: [], brief: true });
    b.damageAt(10, 1, 12, 3, 'burst');
    b.damageAt(10, 1, 12, 3, 'burst');
    expect(b.entries[0].state).toBe('rubble');
    for (let t = 0; t < 12; t += 0.1) {
      b.update(0.1, { x: 0, z: 0 });
      expect(h.added.length).toBe(0);
    }
    expect(b.sim.pieces.length).toBe(0);
  });

  it('a brief thing\'s pieces shrink away as they fly: leaves are gone two seconds after the blow', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    b.register({ ...target, footprints: [], brief: true });
    b.damageAt(10, 1, 12, 3, 'burst');
    b.damageAt(10, 1, 12, 3, 'burst');
    for (let t = 0; t < 2; t += 0.1) b.update(0.1, { x: 0, z: 0 });
    expect(b.sim.pieces.length).toBe(0);
  });
});

describe('Breakables: what things are made of', () => {
  it('a tree drops solid logs from its trunk; only its crown flutters away', () => {
    const h = world();
    const b = new Breakables(h);
    const parent = new Group();
    const root = new Group();
    root.position.set(5, 0, 0);
    const trunk = new Mesh(new BoxGeometry(0.6, 6, 0.6, 2, 12, 2), new MeshStandardMaterial());
    trunk.position.y = 3;
    root.add(trunk);
    parent.add(root);
    b.register({ id: 'pine', object: root, footprints: [], size: 6, tree: true, material: 'wood' });
    for (let i = 0; i < 3; i++) b.damageAt(5, 1, 0, 3, 'burst');
    for (let t = 0; t < 12; t += 0.05) b.update(0.05, { x: 0, z: 0 });
    // Logs stay; the crown's bits are gone.
    expect(b.sim.pieces.length).toBeGreaterThan(0);
    for (const p of b.sim.pieces) expect(p.y).toBeLessThan(3);
  });

  it('a boulder is stone: its pieces stay as rubble (they do not shrink away like leaves)', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    b.register({ ...target, footprints: [], material: 'stone' });
    for (let i = 0; i < 3; i++) b.damageAt(10, 1, 12, 3, 'burst');
    for (let t = 0; t < 12; t += 0.1) b.update(0.1, { x: 0, z: 0 });
    expect(b.sim.pieces.length).toBeGreaterThan(5);
  });
});

describe('local breaking (playtest 2026-11-17: "only the part that was hit breaks")', () => {
  it('blow after blow on one corner knocks out blocks there; the house still stands', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    h.add(...target.footprints);
    b.register(target);
    for (let i = 0; i < 8; i++) b.damageAt(11.8, 4.5, 11.8, 1, 'heavy');
    const e = b.entries[0];
    expect(e.state).toBe('broken');
    const standing = e.chunks.filter((c) => c.standing).length;
    expect(standing).toBeGreaterThan(e.chunks.length * 0.6);
  });
  it('a blow that takes out nearly everything brings the rest down', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    h.add(...target.footprints);
    b.register(target);
    b.damageAt(10, 3, 10, 6, 'burst');
    expect(b.entries[0].state).toBe('rubble');
  });
});

describe('rubbleFootprint (walkable rubble, nothing floating on a too-big box)', () => {
  it('a level block: its top is the block\'s top', async () => {
    const { rubbleFootprint } = await import('./Breakables');
    const f = rubbleFootprint({ x: 0, y: 0.2, z: 0, r: 0.5, qx: 0, qy: 0, qz: 0, qw: 1, hx: 0.4, hy: 0.2, hz: 0.3 } as never);
    expect(f.top).toBeGreaterThan(0.37);
    expect(f.top).toBeLessThanOrEqual(0.4);
  });
  it('a plank leaning at 45°: the box over it is no higher than the plank at its middle', async () => {
    const { rubbleFootprint } = await import('./Breakables');
    const s = Math.sin(Math.PI / 8), c = Math.cos(Math.PI / 8);
    const f = rubbleFootprint({ x: 0, y: 0.5, z: 0, r: 0.6, qx: 0, qy: 0, qz: s, qw: c, hx: 0.5, hy: 0.1, hz: 0.2 } as never);
    // Straight up through its middle it is 0.1/cos45 ≈ 0.14 thick.
    expect(f.top).toBeLessThan(0.5 + 0.16);
  });
});

describe('a broken building keeps no invisible collider where it is gone (pieces rested on thin air)', () => {
  it('a box-collider house broken at one end: the collider there comes down, the standing end stays solid', () => {
    const h = new HeightWorld({ heightAt: () => 0 });
    const b = new Breakables(h);
    const { target } = house();
    target.footprints = [{ kind: 'box', x: 10, z: 10, hw: 2, hd: 2, top: 6 }];
    h.add(...target.footprints);
    b.register(target);
    b.damageAt(11.6, 3, 11.6, 3, 'skill');
    const top = (x: number, z: number) => h.heightAt(x, z, 20);
    expect(b.entries[0].state).toBe('broken');
    expect(top(11.7, 11.7)).toBeLessThan(1);
    expect(top(8.3, 8.3)).toBeGreaterThan(4);
  });
});

describe('rubble colliders do not flicker (walking over rubble "bugged out")', () => {
  it('a piece gets its collider only after it has rested a moment, and keeps it while it rests', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    h.add(...target.footprints);
    b.register(target);
    b.damageAt(10, 3, 10, 6, 'burst');
    let adds = 0;
    const add = h.add;
    h.add = (...f: unknown[]) => { adds += f.length; add(...f); };
    for (let t = 0; t < 12; t += 0.05) b.update(0.05, { x: 0, z: 0 });
    const boxes = h.added.filter((f) => (f as { kind: string }).kind === 'box').length;
    // Each resting piece added once (a flicker adds it again and again).
    expect(adds).toBeLessThanOrEqual(boxes * 1.2 + 2);
  });
});
