/**
 * Drawn icons for the items that have no model of their own yet (ItemLooks `icon`): a fang, a hide, a horn, a pearl in
 * its shell, an antler, a bell, a rib cage, a ring, a crescent moon, a note, an eye, a flame, a star scroll, a book. Each is a white shape with a dark outline,
 * shaded top to bottom, so the sprite's colour paints it (the item's own tint) and the outline stays dark.
 */
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { IconKey } from '../items/ItemLooks';

const S = 128;
const DARK = '#140a24';
const cache = new Map<IconKey, CanvasTexture>();

type Ctx = CanvasRenderingContext2D;

function shade(ctx: Ctx): CanvasGradient {
  const g = ctx.createLinearGradient(0, 10, 0, 118);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#a8a8a8');
  return g;
}

/** A closed shape: shaded fill, dark outline. */
function solid(ctx: Ctx, path: (c: Ctx) => void): void {
  ctx.beginPath();
  path(ctx);
  ctx.closePath();
  ctx.fillStyle = shade(ctx);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = DARK;
  ctx.stroke();
}

/** Strokes (an antler, ribs, a band): a wide dark line under a narrower shaded one. */
function lines(ctx: Ctx, width: number, path: (c: Ctx) => void): void {
  for (const [w, style] of [[width + 7, DARK], [width, shade(ctx)]] as const) {
    ctx.beginPath();
    path(ctx);
    ctx.lineWidth = w;
    ctx.strokeStyle = style;
    ctx.stroke();
  }
}

/** A disc with a disc bitten out of it (the moon), outlined: the outline is the same bite, a little larger. */
function crescent(ctx: Ctx): void {
  for (const [r, bite, style] of [[50, 34, DARK], [44, 40, shade(ctx)]] as const) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(64, 64, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(64, 64, r, 0, Math.PI * 2);
    ctx.arc(86, 48, bite, 0, Math.PI * 2);
    ctx.fillStyle = style;
    ctx.fill('evenodd');
    ctx.restore();
  }
}

const DRAW: Record<IconKey, (ctx: Ctx) => void> = {
  fang: (c) => solid(c, (p) => {
    p.moveTo(36, 24); p.quadraticCurveTo(64, 12, 92, 24);
    p.quadraticCurveTo(94, 80, 50, 114);
    p.quadraticCurveTo(62, 70, 36, 24);
  }),
  hide: (c) => solid(c, (p) => {
    const pts = [[64, 12], [78, 26], [110, 22], [96, 44], [92, 72], [112, 102], [84, 96], [64, 118], [44, 96], [16, 102], [36, 72], [32, 44], [18, 22], [50, 26]];
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= pts.length; i++) {
      const a = pts[i - 1], b = pts[i % pts.length];
      p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
  }),
  horn: (c) => {
    solid(c, (p) => { p.moveTo(26, 108); p.quadraticCurveTo(24, 26, 102, 14); p.quadraticCurveTo(50, 46, 60, 110); p.quadraticCurveTo(44, 116, 26, 108); });
    c.lineWidth = 3; c.strokeStyle = DARK;
    for (const [x0, y0, x1, y1] of [[30, 84, 58, 88], [32, 62, 58, 70], [40, 44, 64, 52], [54, 30, 76, 38]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  },
  pearl: (c) => {
    solid(c, (p) => { p.moveTo(64, 120); p.lineTo(14, 84); p.arc(64, 84, 50, Math.PI, Math.PI * 2); p.lineTo(64, 120); });
    c.lineWidth = 3; c.strokeStyle = DARK;
    for (const a of [-2.6, -2.1, -1.57, -1.05, -0.55]) { c.beginPath(); c.moveTo(64, 118); c.lineTo(64 + Math.cos(a) * 48, 84 + Math.sin(a) * 48); c.stroke(); }
    solid(c, (p) => p.arc(64, 62, 22, 0, Math.PI * 2));
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(56, 54, 6, 0, Math.PI * 2); c.fill();
  },
  antler: (c) => lines(c, 9, (p) => {
    p.moveTo(46, 118); p.quadraticCurveTo(34, 60, 74, 12);
    p.moveTo(42, 84); p.quadraticCurveTo(70, 80, 92, 58);
    p.moveTo(42, 58); p.quadraticCurveTo(64, 46, 70, 26);
    p.moveTo(40, 98); p.quadraticCurveTo(22, 90, 16, 72);
    p.moveTo(84, 66); p.lineTo(108, 62);
  }),
  bell: (c) => {
    solid(c, (p) => p.arc(64, 18, 9, 0, Math.PI * 2));
    solid(c, (p) => { p.moveTo(26, 96); p.quadraticCurveTo(30, 26, 64, 24); p.quadraticCurveTo(98, 26, 102, 96); p.lineTo(112, 104); p.lineTo(16, 104); p.lineTo(26, 96); });
    solid(c, (p) => p.arc(64, 112, 9, 0, Math.PI * 2));
  },
  rib: (c) => lines(c, 7, (p) => {
    p.moveTo(64, 12); p.lineTo(64, 118);
    for (const [y, w] of [[26, 30], [46, 40], [66, 44], [86, 38]]) {
      p.moveTo(64, y); p.quadraticCurveTo(64 - w, y - 2, 64 - w + 4, y + 22);
      p.moveTo(64, y); p.quadraticCurveTo(64 + w, y - 2, 64 + w - 4, y + 22);
    }
  }),
  ring: (c) => {
    lines(c, 11, (p) => p.arc(64, 76, 34, 0, Math.PI * 2));
    solid(c, (p) => { p.moveTo(64, 14); p.lineTo(84, 34); p.lineTo(64, 54); p.lineTo(44, 34); p.lineTo(64, 14); });
  },
  moon: (c) => crescent(c),
  eye: (c) => {
    solid(c, (p) => { p.moveTo(10, 64); p.quadraticCurveTo(64, 10, 118, 64); p.quadraticCurveTo(64, 118, 10, 64); });
    c.fillStyle = DARK; c.beginPath(); c.arc(64, 64, 22, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(64, 64, 6, 17, 0, 0, Math.PI * 2); c.fill();
  },
  scroll: (c) => {
    solid(c, (p) => p.rect(26, 30, 76, 68));
    solid(c, (p) => p.ellipse(64, 28, 46, 10, 0, 0, Math.PI * 2));
    solid(c, (p) => p.ellipse(64, 100, 46, 10, 0, 0, Math.PI * 2));
    c.fillStyle = DARK;
    for (const [x, y, r] of [[44, 50, 6], [76, 46, 4], [62, 66, 7], [86, 76, 4], [42, 80, 4]]) {
      c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.3, y - r * 0.3); c.lineTo(x + r, y); c.lineTo(x + r * 0.3, y + r * 0.3);
      c.lineTo(x, y + r); c.lineTo(x - r * 0.3, y + r * 0.3); c.lineTo(x - r, y); c.lineTo(x - r * 0.3, y - r * 0.3); c.fill();
    }
  },
  book: (c) => {
    solid(c, (p) => { p.moveTo(64, 40); p.quadraticCurveTo(40, 26, 12, 34); p.lineTo(12, 100); p.quadraticCurveTo(40, 92, 64, 106); p.lineTo(64, 40); });
    solid(c, (p) => { p.moveTo(64, 40); p.quadraticCurveTo(88, 26, 116, 34); p.lineTo(116, 100); p.quadraticCurveTo(88, 92, 64, 106); p.lineTo(64, 40); });
    c.lineWidth = 3; c.strokeStyle = DARK;
    for (const y of [50, 62, 74, 86]) for (const side of [-1, 1]) { c.beginPath(); c.moveTo(64 + side * 12, y + 2); c.quadraticCurveTo(64 + side * 30, y - 6, 64 + side * 44, y - 2); c.stroke(); }
  },
  flame: (c) => {
    solid(c, (p) => { p.moveTo(64, 120); p.quadraticCurveTo(18, 112, 30, 70); p.quadraticCurveTo(40, 44, 64, 8); p.quadraticCurveTo(76, 44, 98, 62); p.quadraticCurveTo(112, 112, 64, 120); });
    solid(c, (p) => { p.moveTo(64, 112); p.quadraticCurveTo(44, 106, 50, 84); p.quadraticCurveTo(58, 70, 64, 52); p.quadraticCurveTo(70, 72, 80, 84); p.quadraticCurveTo(84, 106, 64, 112); });
  },
  note: (c) => {
    lines(c, 8, (p) => { p.moveTo(70, 100); p.lineTo(70, 18); p.quadraticCurveTo(84, 40, 104, 46); p.quadraticCurveTo(100, 60, 92, 66); });
    solid(c, (p) => p.ellipse(52, 100, 20, 14, -0.45, 0, Math.PI * 2));
  },
};

/** The icon's texture (white shape, dark outline), drawn once per icon. */
export function lootIconTexture(key: IconKey): CanvasTexture {
  let t = cache.get(key);
  if (t) return t;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.lineJoin = ctx.lineCap = 'round';
  DRAW[key](ctx);
  t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  cache.set(key, t);
  return t;
}
