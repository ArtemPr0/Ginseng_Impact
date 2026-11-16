import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { Breakables, breakHp, canBreak, collapseDelay, POWER, rebuildDue, trimGrid, unheld, type BreakTarget } from './Breakables';
import type { GridFootprint } from './Colliders';

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

  it('comes down when its hit points run out: the collider goes at once, the walls fall one after another', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    h.add(...target.footprints);
    b.register(target);
    b.damageAt(10, 1, 12, 1.5, 'burst');
    const before = b.sim.pieces.length;
    b.damageAt(10, 1, 12, 1.5, 'burst');
    expect(b.entries[0].state).toBe('rubble');
    expect(h.added.length).toBe(0);
    const right = b.sim.pieces.length;
    expect(right).toBeLessThan(b.entries[0].chunks.length);
    for (let t = 0; t < 2; t += 0.05) b.update(0.05, { x: 0, z: 0 });
    expect(b.sim.pieces.length).toBeGreaterThan(right);
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
    for (let i = 0; i < 3; i++) b.damageAt(10, 1, 12, 2, 'burst');
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
    for (let i = 0; i < 3; i++) b.damageAt(10, 1, 12, 2, 'burst');
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
    for (let i = 0; i < 3; i++) b.damageAt(10, 1, 12, 2, 'burst');
    expect(fell).toBe(1);
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
