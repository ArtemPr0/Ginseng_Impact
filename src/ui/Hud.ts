import type { CharacterDef } from '../characters/roster';
import { ELEMENT_COLOR } from '../characters/roster';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

/** Minimal M1 HUD: active character card, stamina bar, pointer-lock prompt, controls card. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly name: HTMLElement;
  private readonly title: HTMLElement;
  private readonly stamina: HTMLElement;
  private readonly staminaWrap: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly party: HTMLElement;

  constructor(container: HTMLElement) {
    this.root = container;
    container.innerHTML = `
      <div class="hud-prompt" id="hud-prompt"><div class="hud-wordmark">GINSENG IMPACT</div><div class="hud-press">CLICK TO ENTER THE FOG</div>
        <div class="hud-controls">WASD move · SHIFT sprint · SPACE jump · 1 2 3 switch · ESC release mouse</div></div>
      <div class="hud-active panel"><div class="hud-name" id="hud-name"></div><div class="hud-title" id="hud-title"></div>
        <div class="hud-stamina-wrap" id="hud-stamina-wrap"><div class="hud-stamina" id="hud-stamina"></div></div></div>
      <div class="hud-party" id="hud-party"></div>`;
    this.name = container.querySelector('#hud-name')!;
    this.title = container.querySelector('#hud-title')!;
    this.stamina = container.querySelector('#hud-stamina')!;
    this.staminaWrap = container.querySelector('#hud-stamina-wrap')!;
    this.prompt = container.querySelector('#hud-prompt')!;
    this.party = container.querySelector('#hud-party')!;
  }

  setParty(defs: readonly CharacterDef[], activeIndex: number): void {
    this.party.innerHTML = defs
      .map((d, i) => `<div class="hud-portrait panel${i === activeIndex ? ' active' : ''}" style="--el:${hex(ELEMENT_COLOR[d.element])}">
        <div class="hud-portrait-key">${i + 1}</div><div class="hud-portrait-name">${d.name}</div></div>`)
      .join('');
    const d = defs[activeIndex];
    this.name.textContent = d.name;
    this.name.style.color = hex(ELEMENT_COLOR[d.element]);
    this.title.textContent = d.title;
  }

  setStamina(value: number, max: number): void {
    const f = value / max;
    this.stamina.style.width = `${Math.round(f * 100)}%`;
    this.staminaWrap.style.opacity = f < 0.999 ? '1' : '0';
  }

  setLocked(locked: boolean): void {
    this.prompt.style.display = locked ? 'none' : 'flex';
    this.root.classList.toggle('locked', locked);
  }
}
