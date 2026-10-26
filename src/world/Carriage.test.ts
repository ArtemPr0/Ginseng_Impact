import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  const ctx = {
    fillStyle: '',
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});

vi.mock('../render/Smoke', () => ({
  PipeSmoke: class {
    emitter = { scale: { setScalar() {} }, position: { set() {} } };
    particles = {};
    update() {}
  },
}));

vi.mock('./ModelLandmark', () => ({
  modelLandmark: () => ({ object: { position: { set() {} }, rotation: { set() {}, y: 0 } } }),
}));

import { CARRIAGE } from './Carriage';

describe('Carriage.drive steering', () => {
  it('positive turn increases heading (D steers right on screen)', () => {
    const c = CARRIAGE;
    c.heading = 0;
    c.speed = 0;
    c.drive(1, 0, 0.5);
    expect(c.speed).toBeGreaterThan(0);
    const before = c.heading;
    c.drive(1, 1, 0.5);
    expect(c.heading).toBeGreaterThan(before);
  });

  it('negative turn decreases heading (A steers left on screen)', () => {
    const c = CARRIAGE;
    c.heading = 0;
    c.speed = 3;
    const before = c.heading;
    c.drive(1, -1, 0.5);
    expect(c.heading).toBeLessThan(before);
  });
});
