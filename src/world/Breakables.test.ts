import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { Breakables, breakHp, canBreak, POWER, rebuildDue, trimGrid, unsupported, type BreakTarget } from './Breakables';
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

describe('unsupported', () => {
  it('a chunk resting on the ground stands; a tower whose middle is blown away drops its top', () => {
    const tower = [0, 1, 2, 3, 4].map((i) => ({ x: 0, y: 0.5 + i, z: 0, r: 0.55 }));
    const standing = [true, true, false, true, true];
    expect(unsupported(tower, standing).sort()).toEqual([3, 4]);
    expect(unsupported(tower, [true, true, true, true, true])).toEqual([]);
  });

  it('a wall held up from the side still stands', () => {
    const wall = [{ x: 0, y: 0.5, z: 0, r: 0.6 }, { x: 1, y: 0.5, z: 0, r: 0.6 }, { x: 1, y: 1.5, z: 0, r: 0.6 }, { x: 0, y: 1.5, z: 0, r: 0.6 }];
    expect(unsupported(wall, [false, true, true, true])).toEqual([]);
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
  it('waits its time, then only rebuilds out of the hero sight', () => {
    expect(rebuildDue({ brokeAt: 0, quick: false }, 100, 200, false)).toBe(false);
    expect(rebuildDue({ brokeAt: 0, quick: false }, 181, 200, false)).toBe(true);
    expect(rebuildDue({ brokeAt: 0, quick: true }, 61, 200, false)).toBe(true);
    expect(rebuildDue({ brokeAt: 0, quick: true }, 61, 20, true)).toBe(false);
    expect(rebuildDue({ brokeAt: 0, quick: true }, 61, 70, true)).toBe(true);
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

  it('comes down when its hit points run out: every chunk flies and the collider goes', () => {
    const h = world();
    const b = new Breakables(h);
    const { target } = house();
    h.add(...target.footprints);
    b.register(target);
    b.damageAt(10, 1, 12, 1.5, 'burst');
    b.damageAt(10, 1, 12, 1.5, 'burst');
    expect(b.entries[0].state).toBe('rubble');
    expect(h.added.length).toBe(0);
    expect(b.sim.active).toBeGreaterThan(5);
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
    for (let t = 0; t < 200; t += 0.5) b.update(0.5, { x: 300, z: 300 });
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
    for (let t = 0; t < 200; t += 0.5) b.update(0.5, { x: 300, z: 300 });
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
