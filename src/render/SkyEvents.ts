import { AdditiveBlending, CanvasTexture, Color, Group, NormalBlending, Sprite, SpriteMaterial, Vector3, type Blending } from 'three';

const R = 500;

function tex(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 256, h = 256): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  return new CanvasTexture(canvas);
}

function soft(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a: number, color = '255,255,255'): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, `rgba(${color},${a})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Burning sun with a face (Mystical Echoes). */
function sunFace(): CanvasTexture {
  return tex((ctx, w, h) => {
    soft(ctx, w / 2, h / 2, 118, 118, 0.55, '90,140,255');
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      soft(ctx, w / 2 + Math.cos(a) * 95, h / 2 + Math.sin(a) * 95, 28, 70, 0.5, '120,170,255');
    }
    soft(ctx, w / 2, h / 2, 70, 70, 1, '200,225,255');
    ctx.fillStyle = 'rgba(10,15,60,0.9)';
    for (const x of [100, 156]) { ctx.beginPath(); ctx.ellipse(x, 112, 13, 17, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(96, 160); ctx.quadraticCurveTo(128, 196, 160, 160); ctx.quadraticCurveTo(128, 178, 96, 160); ctx.fill();
    ctx.fillStyle = 'rgba(55,245,255,0.95)';
    for (const x of [100, 156]) { ctx.beginPath(); ctx.arc(x, 114, 5, 0, Math.PI * 2); ctx.fill(); }
  });
}

/** Giant eye (eclipse / vault eye). */
function eye(): CanvasTexture {
  return tex((ctx, w, h) => {
    soft(ctx, w / 2, h / 2, 125, 70, 0.5, '80,120,255');
    ctx.fillStyle = 'rgba(230,240,255,0.95)';
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 108, 52, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, 46);
    g.addColorStop(0, 'rgba(10,15,40,1)');
    g.addColorStop(0.4, 'rgba(55,245,255,0.95)');
    g.addColorStop(1, 'rgba(30,120,200,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(5,6,15,1)';
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 12, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,50,120,0.8)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 110, 54, 0, 0, Math.PI * 2); ctx.stroke();
  });
}

/** Frog face in the storm (Astral Frog King opening). */
function frogFace(): CanvasTexture {
  return tex((ctx, w, h) => {
    soft(ctx, w / 2, h / 2 + 10, 125, 100, 0.6, '70,110,255');
    soft(ctx, w / 2, h / 2 + 30, 110, 70, 0.6, '50,90,230');
    for (const x of [78, 178]) {
      soft(ctx, x, 88, 34, 30, 0.9, '60,100,255');
      ctx.fillStyle = 'rgba(255,240,200,1)';
      ctx.beginPath(); ctx.arc(x, 90, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(10,15,40,1)';
      ctx.beginPath(); ctx.ellipse(x, 90, 5, 11, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(10,15,60,0.85)';
    ctx.beginPath(); ctx.moveTo(60, 170); ctx.quadraticCurveTo(128, 210, 196, 170); ctx.quadraticCurveTo(128, 186, 60, 170); ctx.fill();
    for (let i = 0; i < 40; i++) soft(ctx, 40 + Math.random() * 176, 60 + Math.random() * 150, 3, 3, 0.9, '140,180,255');
  });
}

/** Whale silhouette with a glowing belly. */
function whale(): CanvasTexture {
  return tex((ctx, w, h) => {
    ctx.fillStyle = 'rgba(10,15,45,0.95)';
    ctx.beginPath();
    ctx.moveTo(20, h * 0.55);
    ctx.quadraticCurveTo(w * 0.3, h * 0.2, w * 0.7, h * 0.35);
    ctx.quadraticCurveTo(w * 0.9, h * 0.42, w - 10, h * 0.3);
    ctx.lineTo(w - 30, h * 0.5);
    ctx.lineTo(w - 10, h * 0.7);
    ctx.quadraticCurveTo(w * 0.8, h * 0.62, w * 0.6, h * 0.7);
    ctx.quadraticCurveTo(w * 0.3, h * 0.85, 20, h * 0.55);
    ctx.fill();
    soft(ctx, w * 0.4, h * 0.62, 90, 24, 0.5, '120,170,255');
    soft(ctx, w * 0.2, h * 0.5, 5, 5, 1, '200,230,255');
  }, 512, 192);
}

/** Aurora curtain strip (used as a sky-sized sprite band). */
function auroraTex(): CanvasTexture {
  return tex((ctx, w, h) => {
    for (let i = 0; i < 40; i++) {
      const x = (i / 40) * w;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(93,255,58,0)');
      g.addColorStop(0.3 + Math.sin(i) * 0.1, 'rgba(93,255,58,0.35)');
      g.addColorStop(0.6, 'rgba(55,245,255,0.25)');
      g.addColorStop(1, 'rgba(139,61,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w / 40 + 2, h);
    }
  }, 512, 256);
}

interface Event { sprite: Sprite; period: number; start: number; length: number; peak: number; dir: Vector3; scale: [number, number]; drift?: Vector3 }

/** Sky apparitions on long cycles, each placed in a different direction so the player sees them while wandering. */
export class SkyEvents {
  readonly group = new Group();
  private readonly events: Event[] = [];
  private time = 0;
  readonly aurora: Sprite;
  /** The Hollow King's sky: a scatter of watching eyes that fades in as the player nears him. */
  private readonly eyes: Sprite[] = [];

  constructor() {
    const make = (map: CanvasTexture, color: number, dir: Vector3, scale: [number, number], period: number, start: number, length: number, peak: number, drift?: Vector3, blending: Blending = AdditiveBlending): Event => {
      const sprite = new Sprite(new SpriteMaterial({ map, color, transparent: true, opacity: 0, fog: false, depthWrite: false, blending }));
      sprite.position.copy(dir).normalize().multiplyScalar(R * 0.96);
      sprite.scale.set(scale[0], scale[1], 1);
      sprite.renderOrder = -7;
      this.group.add(sprite);
      const ev = { sprite, period, start, length, peak, dir: dir.clone().normalize(), scale, drift };
      this.events.push(ev);
      return ev;
    };
    make(sunFace(), 0xaac8ff, new Vector3(0.9, 0.5, 0.2), [150, 150], 260, 20, 45, 0.9);
    make(eye(), 0xffffff, new Vector3(-0.8, 0.55, 0.3), [170, 110], 240, 110, 40, 0.85);
    make(frogFace(), 0x9fc0ff, new Vector3(0.1, 0.5, 1), [190, 190], 300, 160, 50, 0.8);
    make(whale(), 0xffffff, new Vector3(-0.5, 0.45, -0.9), [230, 90], 210, 60, 70, 0.9, new Vector3(0.6, 0.05, -0.2), NormalBlending);
    // Giant eyes (pair) over the gorge direction.
    make(eye(), 0xffffff, new Vector3(0.55, 0.62, -0.7), [120, 80], 240, 200, 35, 0.8);
    make(eye(), 0xffffff, new Vector3(0.75, 0.6, -0.55), [120, 80], 240, 203, 35, 0.8);
    const eyeTex = eye();
    const eyeDirs: Array<[number, number, number, number, number]> = [
      [0.35, 0.72, -0.6, 150, 95], [0.05, 0.8, -0.55, 110, 70], [0.6, 0.55, -0.7, 125, 80], [-0.25, 0.65, -0.7, 95, 60],
      [0.5, 0.85, -0.3, 80, 50], [0.2, 0.45, -0.9, 70, 45], [-0.1, 0.9, -0.35, 60, 38], [0.8, 0.7, -0.45, 55, 35],
    ];
    for (const [x, y, z, w, hgt] of eyeDirs) {
      const sprite = new Sprite(new SpriteMaterial({ map: eyeTex, color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: AdditiveBlending }));
      sprite.position.set(x, y, z).normalize().multiplyScalar(R * 0.94);
      sprite.scale.set(w, hgt, 1);
      sprite.material.rotation = (x - y) * 0.6;
      sprite.renderOrder = -7;
      this.group.add(sprite);
      this.eyes.push(sprite);
    }
    this.aurora = new Sprite(new SpriteMaterial({ map: auroraTex(), color: new Color(0xffffff), transparent: true, opacity: 0.35, fog: false, depthWrite: false, blending: AdditiveBlending }));
    this.aurora.position.set(-0.4, 0.45, -0.85).normalize().multiplyScalar(R * 0.95);
    this.aurora.scale.set(620, 190, 1);
    this.aurora.renderOrder = -9;
    this.group.add(this.aurora);
  }

  update(dt: number, cameraPosition: Vector3, auroraAmount: number, eyesAmount = 0): void {
    this.time += dt;
    this.group.position.copy(cameraPosition);
    for (let i = 0; i < this.eyes.length; i++) {
      // Each eye blinks on its own slow cycle.
      const blink = Math.max(0, Math.min(1, 1 - Math.pow(Math.max(0, Math.sin(this.time * 0.35 + i * 1.7) - 0.93) * 14, 1)));
      this.eyes[i].material.opacity = eyesAmount * 0.9 * blink;
    }
    for (const e of this.events) {
      const p = ((this.time + e.period - e.start) % e.period);
      const f = p < e.length ? Math.sin((p / e.length) * Math.PI) : 0;
      const m = e.sprite.material;
      m.opacity = Math.min(1, f * 1.5) * e.peak;
      if (e.drift) {
        const d = e.dir.clone().addScaledVector(e.drift, (p / e.length - 0.5) * 0.4).normalize().multiplyScalar(R * 0.96);
        e.sprite.position.copy(d);
      }
      e.sprite.scale.set(e.scale[0] * (0.9 + f * 0.1), e.scale[1] * (0.9 + f * 0.1), 1);
    }
    // A faint veil over the island; it only blazes up near the church.
    this.aurora.material.opacity = 0.05 + Math.sin(this.time * 0.3) * 0.03 + auroraAmount * 0.4;
    this.aurora.material.rotation = Math.sin(this.time * 0.05) * 0.04;
  }
}
