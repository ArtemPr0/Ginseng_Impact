/**
 * Real lightning (quality pass of 2026-11-16, replacing a dotted line of glow blobs): a midpoint-displaced main
 * channel with 2-4 forks, drawn as camera-facing ribbons (a white-hot core in a coloured glow), flickering two or
 * three times over a quarter second.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Mesh, ShaderMaterial, Vector3, type ColorRepresentation } from 'three';

export interface BoltPath { points: Vector3[]; width: number }

const LIFE = 0.32;
const MAX_VERTS = 400;

/** Midpoint displacement between a and b: 2^depth segments, each step offset sideways by a shrinking amount. */
function channel(a: Vector3, b: Vector3, depth: number, rough: number): Vector3[] {
  let pts = [a.clone(), b.clone()];
  let off = a.distanceTo(b) * rough;
  for (let d = 0; d < depth; d++) {
    const next: Vector3[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const m = pts[i].clone().lerp(pts[i + 1], 0.5);
      m.x += (Math.random() - 0.5) * off; m.y += (Math.random() - 0.5) * off * 0.5; m.z += (Math.random() - 0.5) * off;
      next.push(pts[i], m);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    off *= 0.55;
  }
  return pts;
}

export function boltPaths(a: Vector3, b: Vector3, width: number): BoltPath[] {
  const main = channel(a, b, 5, 0.18);
  const paths: BoltPath[] = [{ points: main, width }];
  const forks = 2 + Math.floor(Math.random() * 3);
  const len = a.distanceTo(b);
  for (let f = 0; f < forks; f++) {
    const i = 4 + Math.floor(Math.random() * (main.length - 12));
    const from = main[i];
    const dir = main[Math.min(main.length - 1, i + 4)].clone().sub(from).normalize();
    dir.x += (Math.random() - 0.5) * 1.6; dir.z += (Math.random() - 0.5) * 1.6;
    const to = from.clone().addScaledVector(dir.normalize(), len * (0.15 + Math.random() * 0.2));
    paths.push({ points: channel(from, to, 3, 0.25), width: width * (0.35 + Math.random() * 0.2) });
  }
  return paths;
}

interface Slot { mesh: Mesh; geo: BufferGeometry; mat: ShaderMaterial; t: number; on: boolean }

const VERT = `attribute float aSide; attribute vec3 aDir; attribute float aWidth; varying float vSide;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 d = normalize((modelViewMatrix * vec4(aDir, 0.0)).xyz);
  vec3 side = normalize(cross(d, normalize(-mv.xyz)));
  mv.xyz += side * aSide * aWidth;
  vSide = aSide;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `uniform vec3 uColor; uniform float uAlpha; varying float vSide;
void main() {
  float x = abs(vSide);
  float core = smoothstep(0.35, 0.0, x);
  float glow = pow(1.0 - x, 2.0);
  vec3 c = mix(uColor * 1.6, vec3(1.6), core);
  gl_FragColor = vec4(c * (glow * 0.8 + core), 1.0) * uAlpha;
}`;

export class Lightning {
  readonly group = new Group();
  private readonly slots: Slot[] = [];
  private next = 0;

  constructor(pool = 6) {
    this.group.name = 'lightning';
    for (let i = 0; i < pool; i++) {
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(MAX_VERTS * 3), 3));
      geo.setAttribute('aDir', new BufferAttribute(new Float32Array(MAX_VERTS * 3), 3));
      geo.setAttribute('aSide', new BufferAttribute(new Float32Array(MAX_VERTS), 1));
      geo.setAttribute('aWidth', new BufferAttribute(new Float32Array(MAX_VERTS), 1));
      geo.setIndex(new BufferAttribute(new Uint16Array(MAX_VERTS * 3), 1));
      const mat = new ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
        forceSinglePass: true, uniforms: { uColor: { value: new Color() }, uAlpha: { value: 0 } },
      });
      const mesh = new Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = 6;
      this.group.add(mesh);
      this.slots.push({ mesh, geo, mat, t: 0, on: false });
    }
  }

  get live(): number { return this.slots.filter((s) => s.on).length; }

  /** A bolt from `a` to `b` (metres), its glow `width` metres across. */
  strike(a: Vector3, b: Vector3, color: ColorRepresentation, width = 0.35): void {
    const s = this.slots[this.next++ % this.slots.length];
    const pos = s.geo.attributes.position.array as Float32Array;
    const dir = s.geo.attributes.aDir.array as Float32Array;
    const side = s.geo.attributes.aSide.array as Float32Array;
    const wid = s.geo.attributes.aWidth.array as Float32Array;
    const idx = s.geo.index!.array as Uint16Array;
    let v = 0, k = 0;
    for (const p of boltPaths(a, b, width)) {
      const pts = p.points;
      if (v + pts.length * 2 > MAX_VERTS) break;
      const base = v;
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i], r = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
        const taper = p.width * (1 - (i / pts.length) * 0.6);
        for (const sd of [-1, 1]) {
          pos[v * 3] = q.x; pos[v * 3 + 1] = q.y; pos[v * 3 + 2] = q.z;
          dir[v * 3] = r.x - o.x; dir[v * 3 + 1] = r.y - o.y; dir[v * 3 + 2] = r.z - o.z;
          side[v] = sd; wid[v] = taper; v++;
        }
        if (i < pts.length - 1) {
          const j = base + i * 2;
          idx[k++] = j; idx[k++] = j + 1; idx[k++] = j + 2;
          idx[k++] = j + 1; idx[k++] = j + 3; idx[k++] = j + 2;
        }
      }
    }
    for (const n of ['position', 'aDir', 'aSide', 'aWidth']) s.geo.attributes[n].needsUpdate = true;
    s.geo.index!.needsUpdate = true;
    s.geo.setDrawRange(0, k);
    (s.mat.uniforms.uColor.value as Color).set(color);
    s.t = 0; s.on = true; s.mesh.visible = true;
  }

  update(dt: number): void {
    for (const s of this.slots) {
      if (!s.on) continue;
      s.t += dt;
      if (s.t >= LIFE) { s.on = false; s.mesh.visible = false; continue; }
      // Three flickers, each dimmer.
      const k = s.t / LIFE;
      const flick = Math.max(0, Math.cos(k * Math.PI * 6)) ** 0.5;
      s.mat.uniforms.uAlpha.value = (1 - k) * (0.35 + 0.65 * flick);
    }
  }
}
