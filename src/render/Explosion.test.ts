import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Explosions, deepOf } from './Explosion';
import { Color } from 'three';

describe('Explosions (v12: the reel\'s volumetric fireball)', () => {
  it('a burst is a cloud of dozens of billowing puffs, drawn as one instanced mesh', () => {
    const x = new Explosions(400);
    x.burst(new Vector3(0, 0, 0), 4);
    expect(x.live).toBeGreaterThanOrEqual(30);
    expect(x.live).toBeLessThanOrEqual(110);
    expect(x.geometry.instanceCount).toBe(x.live);
  });
  it('swells to about its radius and more within half a second (it fills the screen), hugging the ground with dust', () => {
    const x = new Explosions(400);
    x.burst(new Vector3(0, 0, 0), 4);
    for (let i = 0; i < 10; i++) x.update(0.05);
    expect(x.extent(new Vector3(0, 0, 0))).toBeGreaterThan(4);
    expect(x.extent(new Vector3(0, 0, 0))).toBeLessThan(12);
  });
  it('cools from white-hot through orange to smoke, and the smoke rises', () => {
    const x = new Explosions(400);
    x.burst(new Vector3(0, 0, 0), 4);
    x.update(0.02);
    expect(x.maxHeat()).toBeGreaterThan(0.9);
    const y0 = x.meanY();
    for (let i = 0; i < 40; i++) x.update(0.05);
    expect(x.maxHeat()).toBeLessThan(0.3);
    expect(x.meanY()).toBeGreaterThan(y0 + 1);
  });
  it('is gone within seven seconds, and many bursts at once never pass the cap', () => {
    const x = new Explosions(200);
    for (let i = 0; i < 12; i++) x.burst(new Vector3(i * 3, 0, 0), 5);
    expect(x.live).toBeLessThanOrEqual(200);
    for (let i = 0; i < 80; i++) x.update(0.1);
    expect(x.live).toBe(0);
    expect(x.mesh.visible).toBe(false);
  });
});

describe('Explosions.cloud (v12: the storm tornado\'s shelf cloud, built of the same billowing puffs)', () => {
  it('a wide dark deck of puffs hanging still at its height, spreading out from the middle, gone when it ends', () => {
    const x = new Explosions(400);
    x.cloud(new Vector3(0, 12, 0), 18, 60, 6);
    x.update(0.1);
    const near = x.extent(new Vector3(0, 0, 0));
    for (let i = 0; i < 25; i++) x.update(0.1);
    expect(x.extent(new Vector3(0, 0, 0))).toBeGreaterThan(Math.max(near, 16));
    expect(x.meanY()).toBeGreaterThan(11);
    expect(x.meanY()).toBeLessThan(14);
    expect(x.maxHeat()).toBe(0);
    for (let i = 0; i < 60; i++) x.update(0.1);
    expect(x.live).toBe(0);
  });
});

describe('Explosions near the camera (critic round 2: Earthsplitter whited out the screen)', () => {
  it('a puff fades out as the camera comes inside it, so a blast round the hero never fills the frame with white', () => {
    const ex = new Explosions();
    const mat = ex.mesh.material as unknown as { vertexShader: string; fragmentShader: string };
    // Faded by the depth of its centre against its own size, in the vertex shader...
    expect(mat.vertexShader).toMatch(/vNear\s*=\s*smoothstep\(/);
    // ...and that fade scales everything the puff draws (light and smoke).
    expect(mat.fragmentShader).toMatch(/vAlpha \* vNear|vNear \* vAlpha/);
  });
});

describe('Explosions stay inside the frame\'s light budget (critic round 2: Earthsplitter blew the screen to white)', () => {
  const frag = (new Explosions().mesh.material as unknown as { fragmentShader: string }).fragmentShader;
  it('hot puffs are opaque fire, not light piled on light: each covers what is behind it', () => {
    const m = /emit \* shape \* \(vAlpha \* vNear\) \* ([0-9.]+)\)/.exec(frag);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(0.5);
  });
  it('the white-hot core shines at most about twice its colour (bloom glows, never whites out)', () => {
    const m = /\* \(([0-9.]+) \+ ([0-9.]+) \* h\)/.exec(frag);
    expect(m).not.toBeNull();
    expect(Number(m![1]) + Number(m![2])).toBeLessThanOrEqual(2.2);
  });
});


describe('a cold burst (earth moves: dust, not fire)', () => {
  it('heat 0 throws up a cloud with no fire in it', () => {
    const x = new Explosions(200);
    x.burst(new Vector3(0, 0, 0), 3, { heat: 0 });
    expect(x.live).toBeGreaterThan(20);
    expect(x.maxHeat()).toBe(0);
  });
});

describe('deepOf: what a burst cools through (headless check: Ice Shards and Moonbomb cooled through pink)', () => {
  it('fire cools through deep red, ice through deep blue', () => {
    const fire = deepOf(new Color(0xff7a1a));
    expect(fire.r).toBeGreaterThan(fire.b * 2);
    const ice = deepOf(new Color(0x2f6fd0));
    expect(ice.b).toBeGreaterThan(ice.r * 2);
    expect(ice.b).toBeLessThan(0.6);
  });
});
