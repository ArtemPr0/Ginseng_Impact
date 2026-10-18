/**
 * The Sunken City's water (DeVj-Z8POjl): caustic light dancing over the floor, the sea's surface seen from below
 * with the sun burning through it, shafts of light slanting down, and bubbles rising everywhere. All shaders.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, PlaneGeometry, Points, ShaderMaterial, Vector3 } from 'three';

const clock = { value: 0 };
/** Advances every underwater shader (once a frame, from the realm's update). */
export function tickUnderwater(dt: number): void { clock.value += dt; }

/** Caustic network: two scrolling cell patterns multiplied, the bright web of light under moving water. */
const CAUSTIC = /* glsl */ `
float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cell(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); float d = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y); vec2 o = vec2(hash1(i + g), hash1(i + g + 9.1));
    d = min(d, length(g + o - f));
  }
  return d;
}
float caustic(vec2 p, float t) {
  float a = cell(p * 0.35 + vec2(t * 0.12, t * 0.07));
  float b = cell(p * 0.5 - vec2(t * 0.09, -t * 0.11) + 3.7);
  return pow(clamp(1.0 - a, 0.0, 1.0), 6.0) + pow(clamp(1.0 - b, 0.0, 1.0), 7.0);
}`;

/** Caustic light over a floor: an additive sheet `w` × `d` metres just above `y`, faded at its edges. */
export function causticFloor(x: number, z: number, w: number, d: number, y: number, color = new Color(0.35, 0.95, 1.0)): Mesh {
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, fog: true,
    uniforms: { uTime: clock, uColor: { value: color }, fogColor: { value: new Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 }, fogDensity: { value: 0.03 } },
    vertexShader: /* glsl */ `
      varying vec2 vP; varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() { vUv = uv; vP = (modelMatrix * vec4(position, 1.0)).xz; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; varying vec2 vP; varying vec2 vUv;
      #include <fog_pars_fragment>
      ${CAUSTIC}
      void main() {
        vec2 e = min(vUv, 1.0 - vUv);
        float edge = smoothstep(0.0, 0.06, min(e.x, e.y));
        gl_FragColor = vec4(uColor * caustic(vP, uTime) * 0.16 * edge, 1.0);
        #include <fog_fragment>
      }`,
  });
  const m = new Mesh(new PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y + 0.04, z);
  m.renderOrder = 3;
  return m;
}

/**
 * The sea's surface seen from below, `y` metres up: teal and rippling, a web of bright light through it and a sun
 * burning a white hole at (sunX, sunZ) (the reel's street looks up at it).
 */
export function waterCeiling(x: number, z: number, w: number, d: number, y: number, sunX: number, sunZ: number): Mesh {
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, side: DoubleSide,
    uniforms: { uTime: clock, uSun: { value: new Vector3(sunX, y, sunZ) }, fogColor: { value: new Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 }, fogDensity: { value: 0.02 } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      #include <fog_pars_vertex>
      void main() { vP = (modelMatrix * vec4(position, 1.0)).xz; vec4 mvPosition = viewMatrix * modelMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uSun; varying vec2 vP;
      #include <fog_pars_fragment>
      ${CAUSTIC}
      void main() {
        float c = caustic(vP * 0.8, uTime * 1.3);
        float sd = length(vP - uSun.xz);
        // The sun burning through, and a web of light round it; the rest a deep teal that fades into the murk.
        float sun = exp(-sd * 0.07) * 1.5 + exp(-sd * 0.02) * 0.2;
        vec3 col = vec3(0.01, 0.1, 0.14) + vec3(0.2, 0.75, 0.8) * c * (0.14 + sun * 0.4) + vec3(0.75, 1.0, 1.0) * sun;
        gl_FragColor = vec4(col, 0.9);
        #include <fog_fragment>
      }`,
  });
  const m = new Mesh(new PlaneGeometry(w, d), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.renderOrder = 1;
  return m;
}

/**
 * Shafts of light slanting down through the water: tall soft additive blades, each turned toward the camera about
 * its own long axis (in the vertex shader), shimmering. Each shaft: top point, length, width, lean.
 */
export function lightShafts(shafts: Array<{ x: number; y: number; z: number; length: number; width: number; tilt?: number }>, color = new Color(0.55, 0.9, 1.0)): Group {
  const g = new Group();
  shafts.forEach((s, i) => {
    const tilt = s.tilt ?? 0.18;
    const axis = new Vector3(Math.sin(tilt), Math.cos(tilt), 0);
    const mat = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false, side: DoubleSide,
      uniforms: { uTime: clock, uColor: { value: color }, uSeed: { value: i * 1.7 }, uAxis: { value: axis }, uWidth: { value: s.width } },
      vertexShader: /* glsl */ `
        uniform vec3 uAxis; uniform float uWidth; varying vec2 vUv;
        void main() {
          vUv = uv;
          // The blade's centre line runs along uAxis; it spreads sideways across the view.
          vec3 along = normalize(uAxis);
          vec3 centre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz + along * position.y;
          vec3 side = normalize(cross(along, cameraPosition - centre));
          vec3 world = centre + side * (uv.x - 0.5) * uWidth;
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uColor; uniform float uSeed; varying vec2 vUv;
        void main() {
          float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float shimmer = 0.75 + 0.25 * sin(uTime * 0.8 + uSeed + vUv.y * 6.0);
          // Bright at the top, gone by the floor.
          float a = pow(across, 2.2) * smoothstep(0.0, 0.7, vUv.y) * shimmer * 0.42;
          gl_FragColor = vec4(uColor * a, 1.0);
        }`,
    });
    const m = new Mesh(new PlaneGeometry(s.width, s.length), mat);
    // Centred halfway down the shaft (the geometry's y runs ±length/2 along the axis).
    m.position.set(s.x, s.y, s.z).addScaledVector(axis, -s.length / 2);
    m.frustumCulled = false;
    m.renderOrder = 5;
    g.add(m);
  });
  return g;
}

/**
 * Bubbles rising through a box (`w` × `d`, from `y` up `h` metres): small glassy points that wobble upward and come
 * back at the bottom.
 */
export function risingBubbles(x: number, z: number, w: number, d: number, y: number, h: number, count = 500): { points: Points; update(dt: number): void } {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = x + (Math.random() - 0.5) * w;
    pos[i * 3 + 1] = y + Math.random() * h;
    pos[i * 3 + 2] = z + (Math.random() - 0.5) * d;
    seed[i] = Math.random();
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('seed', new BufferAttribute(seed, 1));
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uScale: { value: 520 } },
    vertexShader: /* glsl */ `
      uniform float uScale; attribute float seed; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.5, (0.05 + seed * 0.1) * uScale / -mv.z);
        vA = smoothstep(80.0, 10.0, -mv.z) * 0.8;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5; float r = length(c);
        // A ring with a bright fleck: a bubble, not a dot.
        float ring = smoothstep(0.5, 0.4, r) * (0.35 + 0.65 * smoothstep(0.2, 0.42, r));
        float fleck = smoothstep(0.12, 0.0, length(c - vec2(-0.15, -0.15)));
        gl_FragColor = vec4(vec3(0.75, 0.95, 1.0), (ring * 0.6 + fleck) * vA);
      }`,
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  let t = 0;
  return {
    points,
    update(dt) {
      t += dt;
      for (let i = 0; i < count; i++) {
        const s = seed[i];
        let py = pos[i * 3 + 1] + (0.6 + s * 0.9) * dt;
        if (py > y + h) py = y;
        pos[i * 3 + 1] = py;
        pos[i * 3] += Math.sin(t * 3 + s * 40) * 0.2 * dt;
      }
      (geo.attributes.position as BufferAttribute).needsUpdate = true;
    },
  };
}
