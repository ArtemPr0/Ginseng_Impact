import type { CharacterDef } from '../characters/roster';
import { ELEMENT_COLOR } from '../characters/roster';
import { glyph } from './glyphs';

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
  private readonly hp: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly skill: HTMLElement;
  private readonly skillName: HTMLElement;
  private readonly skillCd: HTMLElement;
  private readonly bars = new Map<number, HTMLElement>();
  private readonly numbers: HTMLElement;
  private readonly banner: HTMLElement;
  private bannerTimer = 0;

  constructor(container: HTMLElement) {
    this.root = container;
    container.innerHTML = `
      <div class="hud-prompt" id="hud-prompt"><div class="hud-subtitle">A SILENT KINGDOM BEYOND THE FOG</div><div class="hud-wordmark">GINSENG IMPACT</div><div class="hud-press">CLICK TO ENTER THE FOG</div>
        <div class="hud-controls">WASD move · SHIFT sprint · SPACE jump, climb, glide · LMB attack · E skill · 1 2 3 switch · ESC pause</div></div>
      <div class="hud-active panel"><div class="hud-name" id="hud-name"></div><div class="hud-title" id="hud-title"></div>
        <div class="hud-hp-wrap"><div class="hud-hp" id="hud-hp"></div><div class="hud-hp-text" id="hud-hp-text"></div></div>
        <div class="hud-stamina-wrap" id="hud-stamina-wrap"><div class="hud-stamina" id="hud-stamina"></div></div></div>
      <div class="hud-party" id="hud-party"></div>
      <div class="hud-skill panel" id="hud-skill"><div class="hud-skill-key">E</div><div class="hud-skill-cd" id="hud-skill-cd"></div><div class="hud-skill-name" id="hud-skill-name"></div></div>
      <div class="hud-numbers" id="hud-numbers"></div>
      <div class="hud-banner" id="hud-banner"></div>
      <div class="hud-hint">LMB attack · E skill</div>`;
    this.name = container.querySelector('#hud-name')!;
    this.title = container.querySelector('#hud-title')!;
    this.stamina = container.querySelector('#hud-stamina')!;
    this.staminaWrap = container.querySelector('#hud-stamina-wrap')!;
    this.prompt = container.querySelector('#hud-prompt')!;
    this.party = container.querySelector('#hud-party')!;
    this.hp = container.querySelector('#hud-hp')!;
    this.hpText = container.querySelector('#hud-hp-text')!;
    this.skill = container.querySelector('#hud-skill')!;
    this.skillName = container.querySelector('#hud-skill-name')!;
    this.skillCd = container.querySelector('#hud-skill-cd')!;
    this.numbers = container.querySelector('#hud-numbers')!;
    this.banner = container.querySelector('#hud-banner')!;
  }

  setHp(value: number, max: number): void {
    const f = Math.max(0, value / max);
    this.hp.style.width = `${Math.round(f * 100)}%`;
    this.hpText.textContent = `${Math.round(value)} / ${max}`;
    this.hp.classList.toggle('low', f < 0.3);
  }

  setSkill(name: string, cooldownFraction: number, ready: boolean): void {
    this.skillName.textContent = name;
    this.skillCd.style.setProperty('--cd', `${Math.round(cooldownFraction * 360)}deg`);
    this.skill.classList.toggle('ready', ready);
    this.skillCd.textContent = cooldownFraction > 0 ? '' : '';
  }

  enemyBar(id: number, name: string, x: number, y: number, fraction: number, auraColor: number | null, visible: boolean, auraElement: import('../combat/Elements').Element | null = null): void {
    let el = this.bars.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'hud-enemy';
      el.innerHTML = `<div class="hud-enemy-name"></div><div class="hud-enemy-bar"><div class="hud-enemy-fill"></div></div><div class="hud-enemy-aura"></div>`;
      this.root.appendChild(el);
      this.bars.set(id, el);
    }
    el.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    (el.querySelector('.hud-enemy-name') as HTMLElement).textContent = name;
    (el.querySelector('.hud-enemy-fill') as HTMLElement).style.width = `${Math.round(fraction * 100)}%`;
    const aura = el.querySelector('.hud-enemy-aura') as HTMLElement;
    aura.style.display = auraColor === null ? 'none' : 'block';
    if (auraColor !== null && auraElement !== null && aura.dataset.el !== auraElement) {
      aura.dataset.el = auraElement;
      aura.innerHTML = glyph(auraElement, hex(auraColor), 14);
    }
  }

  removeEnemyBar(id: number): void {
    const el = this.bars.get(id);
    if (el) el.style.display = 'none';
  }

  damageNumber(x: number, y: number, text: string, color: number, big: boolean): void {
    const el = document.createElement('div');
    el.className = big ? 'hud-num big' : 'hud-num';
    el.textContent = text;
    el.style.color = hex(color);
    el.style.left = `${Math.round(x + (Math.random() - 0.5) * 24)}px`;
    el.style.top = `${Math.round(y)}px`;
    this.numbers.appendChild(el);
    window.setTimeout(() => el.remove(), big ? 900 : 650);
  }

  flashDamage(): void {
    this.root.classList.add('hurt');
    window.setTimeout(() => this.root.classList.remove('hurt'), 160);
  }

  announce(text: string): void {
    this.banner.textContent = text;
    this.banner.classList.add('show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), 2200);
  }

  setParty(defs: readonly CharacterDef[], activeIndex: number): void {
    this.party.innerHTML = defs
      .map((d, i) => `<div class="hud-portrait panel${i === activeIndex ? ' active' : ''}" style="--el:${hex(ELEMENT_COLOR[d.element])}">
        <div class="hud-portrait-key">${i + 1}</div><div class="hud-portrait-glyph">${glyph(d.element, hex(ELEMENT_COLOR[d.element]), 22)}</div><div class="hud-portrait-name">${d.name}</div></div>`)
      .join('');
    const d = defs[activeIndex];
    this.name.innerHTML = `${glyph(d.element, hex(ELEMENT_COLOR[d.element]), 18)} ${d.name}`;
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
