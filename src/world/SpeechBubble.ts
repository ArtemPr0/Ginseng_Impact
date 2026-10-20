/**
 * A short line of speech floating above an NPC's head: a camera-facing sprite drawn on a canvas in the HUD's
 * style (navy panel, 1 px silver border, moon-white text). Fades in, holds, fades out.
 */
import { CanvasTexture, Sprite, SpriteMaterial } from 'three';

export class SpeechBubble {
  readonly sprite: Sprite;
  private readonly mat: SpriteMaterial;
  private readonly canvas = document.createElement('canvas');
  private left = 0;
  private hold = 0;

  constructor(private readonly heightAbove: number) {
    this.canvas.width = 512;
    this.canvas.height = 112;
    // Depth-tested: a wall between you and the speaker hides it (the stone head's sits in front of its mouth).
    this.mat = new SpriteMaterial({ map: new CanvasTexture(this.canvas), transparent: true, depthWrite: false, depthTest: true, opacity: 0 });
    this.sprite = new Sprite(this.mat);
    this.sprite.scale.set(2.6, 2.6 * (112 / 512), 1);
    this.sprite.position.y = heightAbove;
    this.sprite.renderOrder = 20;
    this.sprite.visible = false;
  }

  say(text: string, seconds: number): void {
    const c = this.canvas.getContext('2d')!;
    c.clearRect(0, 0, 512, 112);
    // One line when it fits; a long line goes onto two, smaller, split at the space nearest the middle.
    const font = (px: number) => `600 ${px}px Inter, "Helvetica Neue", Arial, sans-serif`;
    let lines = [text];
    let px = 34;
    c.font = font(px);
    if (c.measureText(text).width > 452) {
      let cut = -1;
      for (let i = 0; i < text.length; i++) if (text[i] === ' ' && Math.abs(i - text.length / 2) < Math.abs(cut - text.length / 2)) cut = i;
      lines = cut > 0 ? [text.slice(0, cut), text.slice(cut + 1)] : [text];
      px = 26;
      c.font = font(px);
      while (px > 12 && Math.max(...lines.map((l) => c.measureText(l).width)) > 452) { px -= 1; c.font = font(px); }
    }
    const w = Math.min(500, Math.max(...lines.map((l) => c.measureText(l).width)) + 48);
    const x = (512 - w) / 2;
    c.fillStyle = 'rgba(10,15,46,0.86)';
    c.fillRect(x, 8, w, 72);
    c.strokeStyle = 'rgba(223,230,255,0.85)';
    c.lineWidth = 2;
    c.strokeRect(x + 1, 9, w - 2, 70);
    // Little tail pointing down at the speaker.
    c.beginPath();
    c.moveTo(256 - 12, 80);
    c.lineTo(256, 104);
    c.lineTo(256 + 12, 80);
    c.closePath();
    c.fillStyle = 'rgba(10,15,46,0.86)';
    c.fill();
    c.fillStyle = '#dfe6ff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (lines.length === 1) c.fillText(lines[0], 256, 45);
    else { c.fillText(lines[0], 256, 45 - px * 0.6); c.fillText(lines[1], 256, 45 + px * 0.6); }
    (this.mat.map as CanvasTexture).needsUpdate = true;
    this.hold = seconds;
    this.left = seconds + 0.5;
    this.sprite.visible = true;
  }

  update(dt: number): void {
    if (this.left <= 0) return;
    this.left -= dt;
    const t = this.hold + 0.5 - this.left;
    this.mat.opacity = Math.min(1, t / 0.15, Math.max(0, this.left) / 0.35);
    this.sprite.position.y = this.heightAbove + Math.min(1, t / 0.15) * 0.08;
    if (this.left <= 0) this.sprite.visible = false;
  }
}
