/**
 * Big Gerald's ink on the screen (the playtest of 2026-11-14: boss attacks "fun like the npcs that throw lean cups"):
 * when his jet catches you, a handful of violet-black blots splat over the view, drip a little and fade.
 */

export interface InkBlot {
  /** Centre, in % of the screen's width and height. */
  x: number;
  y: number;
  /** Diameter, in % of the screen's height. */
  size: number;
  /** Turn, degrees (the blot's lobes and drip point every way). */
  turn: number;
}

/** Where the blots land: 4 to 7 of them, one always over the middle of the view. */
export function inkBlots(rand: () => number = Math.random): InkBlot[] {
  const n = 4 + Math.floor(rand() * 4);
  const out: InkBlot[] = [{ x: 40 + rand() * 20, y: 40 + rand() * 20, size: 30 + rand() * 12, turn: rand() * 360 }];
  for (let i = 1; i < n; i++) out.push({ x: 8 + rand() * 84, y: 8 + rand() * 84, size: 14 + rand() * 22, turn: rand() * 360 });
  return out;
}

const SPLAT_SECONDS = 2.6;

/** One blot's shape: a solid ink body with lobes, drips and specks, a violet edge round the whole of it, a wet shine. */
function blotSvg(): string {
  const shape = '<circle r="30"/><circle cx="26" cy="-14" r="13"/><circle cx="-24" cy="-20" r="11"/><circle cx="-20" cy="24" r="12"/>'
    + '<circle cx="30" cy="20" r="8"/><circle cx="-38" cy="2" r="6"/><rect x="-2" y="20" width="12" height="26" rx="6"/>'
    + '<circle cx="4" cy="48" r="6"/><rect x="-28" y="26" width="7" height="18" rx="3.5"/><circle cx="44" cy="-30" r="3.5"/>'
    + '<circle cx="-44" cy="-34" r="2.5"/><circle cx="46" cy="8" r="2.5"/>';
  return '<svg viewBox="-56 -56 112 112" xmlns="http://www.w3.org/2000/svg">'
    + `<g fill="#8a3ff0" opacity="0.75" transform="scale(1.07)">${shape}</g>`
    + `<g fill="#12021f">${shape}</g>`
    + '<ellipse cx="-10" cy="-12" rx="10" ry="6" fill="#ffffff" opacity="0.13" transform="rotate(-30)"/></svg>';
}

/** The overlay: `splash()` throws a fresh set of blots and lets them run and fade. */
export class InkSplat {
  private readonly layer: HTMLElement;
  private timer = 0;

  /** Drawn just under `hud` (the bars and the boss's name stay readable through it). */
  constructor(hud: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'ink-splat';
    hud.parentElement!.insertBefore(this.layer, hud);
  }

  splash(): void {
    window.clearTimeout(this.timer);
    this.layer.innerHTML = inkBlots()
      .map((b, i) => `<div class="ink-blot" style="left:${b.x}%;top:${b.y}%;width:${b.size}vh;height:${b.size}vh;`
        + `--turn:${b.turn.toFixed(0)}deg;animation-delay:${(i * 0.04).toFixed(2)}s">${blotSvg()}</div>`)
      .join('');
    this.layer.classList.remove('on');
    void this.layer.offsetWidth;
    this.layer.classList.add('on');
    this.timer = window.setTimeout(() => { this.layer.classList.remove('on'); this.layer.innerHTML = ''; }, SPLAT_SECONDS * 1000);
  }
}
