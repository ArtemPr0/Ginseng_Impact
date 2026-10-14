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
    this.mat = new SpriteMaterial({ map: new CanvasTexture(this.canvas), transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
    this.sprite = new Sprite(this.mat);
    this.sprite.scale.set(2.6, 2.6 * (112 / 512), 1);
    this.sprite.position.y = heightAbove;
    this.sprite.renderOrder = 20;
    this.sprite.visible = false;
  }

  say(text: string, seconds: number): void {
    const c = this.canvas.getContext('2d')!;
    c.clearRect(0, 0, 512, 112);
    c.font = '600 34px Inter, "Helvetica Neue", Arial, sans-serif';
    const w = Math.min(500, c.measureText(text).width + 48);
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
    c.fillText(text, 256, 45);
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
