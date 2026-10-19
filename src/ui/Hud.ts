import type { CharacterDef } from '../characters/roster';
import { ELEMENT_COLOR, ROSTER } from '../characters/roster';
import type { Element } from '../combat/Elements';
import { ITEMS, RARITY_NAME, canWield } from '../items/Items';
import type { Inventory } from '../items/Inventory';
import type { NpcDef } from '../world/NPCs';
import { glyph } from './glyphs';
import type { DialogueNode } from '../game/Dialogue';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export interface HudActions {
  onBuy(itemId: string, price: number): boolean;
  onSell(uid: number, count: number): void;
  /** Hires the NPC: 'ok', or why not ('poor': not enough shards, 'full': three companions already). */
  onHire(npc: NpcDef): 'ok' | 'poor' | 'full';
  onEquip(uid: number): boolean;
  onUse(uid: number): boolean;
  onDrop(uid: number): void;
  onClose(): void;
}

export type Panel = 'none' | 'talk' | 'shop' | 'inventory';

export interface BannerOpts {
  /** How long the banner stays, in seconds (2.2 by default). */
  seconds?: number;
  /** A higher priority goes ahead of the lower ones still waiting (0 by default); the banner on screen always finishes. */
  priority?: number;
}

/** A breath of dark between two banners, so the second one visibly steps in (the fade is 120 ms). */
const BANNER_GAP = 0.2;

/**
 * The banner line, one message at a time: the next shows once the current one has had its seconds, in order of arrival
 * (a higher priority jumps the ones still waiting, never the one on screen). Pure: the HUD lends it show/hide and a timer.
 */
export class BannerQueue {
  private readonly waiting: Array<{ text: string; seconds: number; priority: number }> = [];
  private busy = false;

  constructor(private readonly io: { show(text: string): void; hide(): void; after(seconds: number, fn: () => void): void }) {}

  push(text: string, { seconds = 2.2, priority = 0 }: BannerOpts = {}): void {
    // Behind everything waiting with the same or a higher priority, ahead of the lower ones.
    let i = this.waiting.length;
    while (i > 0 && this.waiting[i - 1].priority < priority) i--;
    this.waiting.splice(i, 0, { text, seconds, priority });
    if (!this.busy) this.next();
  }

  private next(): void {
    const item = this.waiting.shift();
    if (!item) { this.busy = false; return; }
    this.busy = true;
    this.io.show(item.text);
    this.io.after(item.seconds, () => {
      this.io.hide();
      this.io.after(BANNER_GAP, () => this.next());
    });
  }
}

/** DOM HUD: Genshin layout, dark-fantasy skin. Panels (talk, shop, inventory) take the pointer. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly q = <T extends HTMLElement>(sel: string): T => this.root.querySelector(sel) as T;
  private readonly bars = new Map<number, HTMLElement>();
  private readonly banners = new BannerQueue({
    show: (text) => { const b = this.q('#hud-banner'); b.textContent = text; b.classList.add('show'); },
    hide: () => this.q('#hud-banner').classList.remove('show'),
    after: (seconds, fn) => { window.setTimeout(fn, Math.round(seconds * 1000)); },
  });
  /** What the HUD last drew (it only touches the DOM when something changed). */
  private interactText: string | null = null;
  private interactShown = false;
  private timerShown = -2;
  private timerLabel = '';
  /** NPCs who already follow you (no Hire button), and the conversation the shop's Back returns to. */
  private readonly hired = new Set<string>();
  private lastNode: { head: { name: string; title: string }; node: DialogueNode } | null = null;
  private burstName = '';
  panel: Panel = 'none';
  private talkNpc: NpcDef | null = null;
  private talkLine = 0;
  private actions: HudActions | null = null;
  private inventory: Inventory | null = null;
  private activeChar: CharacterDef | null = null;
  private companions: string[] = [];

  constructor(container: HTMLElement) {
    this.root = container;
    container.innerHTML = `
      <div class="hud-prompt" id="hud-prompt"><div class="hud-subtitle">A SILENT KINGDOM BEYOND THE FOG</div><div class="hud-wordmark">GINSENG IMPACT</div><div class="hud-press" id="hud-press">CLICK TO ENTER THE FOG</div>
        <div class="hud-controls">WASD move · SHIFT sprint · SPACE jump, again to fly (hold to rise) · C dive · X land · LMB attack · hold RMB heavy · E skill · Q burst · R dodge · F talk / loot · I inventory · 1 2 3 switch · ESC pause</div></div>
      <div class="hud-boss panel" id="hud-boss"><div class="hud-boss-name" id="hud-boss-name"></div><div class="hud-boss-title" id="hud-boss-title"></div><div class="hud-boss-bar"><div class="hud-boss-fill" id="hud-boss-fill"></div></div></div>
      <div class="hud-shards panel" id="hud-shards"><span class="hud-shard-glyph">◆</span><span id="hud-shards-n">0</span><span class="hud-shards-pop" id="hud-shards-pop"></span></div>
      <div class="hud-active panel"><div class="hud-name" id="hud-name"></div><div class="hud-title" id="hud-title"></div>
        <div class="hud-hp-wrap"><div class="hud-hp" id="hud-hp"></div><div class="hud-hp-text" id="hud-hp-text"></div></div>
        <div class="hud-stamina-wrap" id="hud-stamina-wrap"><div class="hud-stamina" id="hud-stamina"></div></div>
        <div class="hud-frenzy" id="hud-frenzy"></div></div>
      <div class="hud-party" id="hud-party"></div>
      <div class="hud-companions" id="hud-companions"></div>
      <div class="hud-skill panel" id="hud-skill"><div class="hud-skill-key">E</div><div class="hud-skill-cd" id="hud-skill-cd"></div><div class="hud-skill-name" id="hud-skill-name"></div></div>
      <div class="hud-burst panel" id="hud-burst"><div class="hud-skill-key">Q</div><div class="hud-burst-fill" id="hud-burst-fill"></div><div class="hud-skill-name" id="hud-burst-name">Burst</div></div>
      <div class="hud-charge" id="hud-charge"><div class="hud-charge-fill" id="hud-charge-fill"></div></div>
      <div class="hud-interact" id="hud-interact"></div>
      <div class="hud-numbers" id="hud-numbers"></div>
      <div class="hud-banner" id="hud-banner"></div>
      <div class="hud-curtain" id="hud-curtain"></div>
      <div class="hud-hint">LMB attack · RMB heavy · E skill · Q burst · R dodge · F interact · I bag</div>
      <div class="hud-quests" id="hud-quests"></div>
      <div class="hud-timer panel" id="hud-timer"><div class="hud-timer-label" id="hud-timer-label"></div><div class="hud-timer-time" id="hud-timer-time"></div></div>
      <div class="hud-panel panel" id="hud-dialog"></div>`;
  }

  // ---------- quests, buffs, the countdown ----------
  /** The quest tracker under the shard counter, and active buffs with their time left (seconds). */
  setQuests(quests: Array<{ title: string; objective: string }>, buffs: Array<{ name: string; left: number }> = []): void {
    const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const html = quests.map((q) => `<div class="hud-quest panel"><div class="hud-quest-title">${q.title}</div><div class="hud-quest-obj">${q.objective}</div></div>`).join('')
      + buffs.map((b) => `<div class="hud-buff panel">${b.name} <span>${mmss(b.left)}</span></div>`).join('');
    // (Compared with what was last written, not read back from the DOM: this runs every step.)
    if (html === this.questHtml) return;
    this.questHtml = html;
    this.q('#hud-quests').innerHTML = html;
  }

  /** Last value each per-step readout wrote, so unchanged frames touch no DOM. */
  private questHtml = '';
  private readonly shown = new Map<string, string>();
  private changed(key: string, value: string): boolean {
    if (this.shown.get(key) === value) return false;
    this.shown.set(key, value);
    return true;
  }

  /** A countdown in the top-right corner (the frog's dream), or null to hide it. */
  setTimer(seconds: number | null, label = ''): void {
    const s = seconds === null ? -1 : Math.max(0, Math.ceil(seconds));
    if (s === this.timerShown && label === this.timerLabel) return;
    this.timerShown = s;
    this.timerLabel = label;
    const el = this.q('#hud-timer');
    el.style.display = seconds === null ? 'none' : 'block';
    if (seconds === null) return;
    this.q('#hud-timer-label').textContent = label;
    this.q('#hud-timer-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  bind(actions: HudActions, inventory: Inventory): void {
    this.actions = actions;
    this.inventory = inventory;
  }

  // ---------- combat readouts ----------
  setHp(value: number, max: number): void {
    if (!this.changed('hp', `${Math.round(value)}/${max}`)) return;
    const f = Math.max(0, value / max);
    this.q('#hud-hp').style.width = `${Math.round(f * 100)}%`;
    this.q('#hud-hp-text').textContent = `${Math.round(value)} / ${max}`;
    this.q('#hud-hp').classList.toggle('low', f < 0.3);
  }

  setSkill(name: string, cooldownFraction: number, ready: boolean): void {
    if (!this.changed('skill', `${name}|${Math.round(cooldownFraction * 360)}|${ready}`)) return;
    this.q('#hud-skill-name').textContent = name;
    this.q('#hud-skill-cd').style.setProperty('--cd', `${Math.round(cooldownFraction * 360)}deg`);
    this.q('#hud-skill').classList.toggle('ready', ready);
  }

  setBurst(fraction: number, ready: boolean, name?: string): void {
    if (!this.changed('burst', `${Math.round(fraction * 100)}|${ready}|${name ?? ''}`)) return;
    this.q('#hud-burst-fill').style.height = `${Math.round(fraction * 100)}%`;
    this.q('#hud-burst').classList.toggle('ready', ready);
    if (name && name !== this.burstName) { this.burstName = name; this.q('#hud-burst-name').textContent = name; }
  }

  setCharge(fraction: number): void {
    if (!this.changed('charge', `${Math.round(fraction * 100)}`)) return;
    const el = this.q('#hud-charge');
    el.style.opacity = fraction > 0 ? '1' : '0';
    this.q('#hud-charge-fill').style.width = `${Math.round(fraction * 100)}%`;
    el.classList.toggle('full', fraction >= 1);
  }

  setFrenzy(seconds: number): void {
    if (!this.changed('frenzy', `${Math.ceil(seconds)}`)) return;
    const el = this.q('#hud-frenzy');
    el.textContent = seconds > 0 ? `LOTUS FRENZY ${Math.ceil(seconds)}s` : '';
  }

  setShards(n: number): void {
    if (!this.changed('shards', String(n))) return;
    this.q('#hud-shards-n').textContent = String(n);
  }

  shardPop(n: number): void {
    const el = this.q('#hud-shards-pop');
    el.textContent = `+${n}`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  setBoss(name: string, title: string, fraction: number, visible: boolean): void {
    const el = this.q('#hud-boss');
    el.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    this.q('#hud-boss-name').textContent = name;
    this.q('#hud-boss-title').textContent = title;
    this.q('#hud-boss-fill').style.width = `${Math.round(fraction * 100)}%`;
  }

  setInteract(text: string | null): void {
    const show = !!text && this.panel === 'none';
    if (text === this.interactText && show === this.interactShown) return;
    this.interactText = text;
    this.interactShown = show;
    const el = this.q('#hud-interact');
    el.style.display = show ? 'block' : 'none';
    if (text) el.innerHTML = `<span class="key">F</span> ${text}`;
  }

  enemyBar(id: number, name: string, x: number, y: number, fraction: number, auraColor: number | null, visible: boolean, auraElement: Element | null = null): void {
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
    if (el) { el.remove(); this.bars.delete(id); }
  }

  damageNumber(x: number, y: number, text: string, color: number, big: boolean): void {
    const el = document.createElement('div');
    el.className = big ? 'hud-num big' : 'hud-num';
    el.textContent = text;
    el.style.color = hex(color);
    el.style.left = `${Math.round(x + (Math.random() - 0.5) * 24)}px`;
    el.style.top = `${Math.round(y)}px`;
    this.q('#hud-numbers').appendChild(el);
    window.setTimeout(() => el.remove(), big ? 900 : 650);
  }

  /** A moment of black that fades away (a door or a portal: the jump to the other side happens behind it). */
  curtain(): void {
    const c = this.q('#hud-curtain');
    c.classList.remove('lift');
    c.classList.add('down');
    void c.offsetWidth;
    c.classList.remove('down');
    c.classList.add('lift');
  }

  flashDamage(): void {
    this.root.classList.add('hurt');
    window.setTimeout(() => this.root.classList.remove('hurt'), 160);
  }

  /** A line across the screen for `seconds` (2.2 by default); later calls wait their turn (see BannerQueue). */
  announce(text: string, opts: BannerOpts = {}): void {
    this.banners.push(text, opts);
  }

  setParty(defs: readonly CharacterDef[], activeIndex: number): void {
    this.q('#hud-party').innerHTML = defs
      .map((d, i) => `<div class="hud-portrait panel${i === activeIndex ? ' active' : ''}" style="--el:${hex(ELEMENT_COLOR[d.element])}">
        <div class="hud-portrait-key">${i + 1}</div><div class="hud-portrait-glyph">${glyph(d.element, hex(ELEMENT_COLOR[d.element]), 22)}</div><div class="hud-portrait-name">${d.name}</div></div>`)
      .join('');
    const d = defs[activeIndex];
    this.activeChar = d;
    this.q('#hud-name').innerHTML = `${glyph(d.element, hex(ELEMENT_COLOR[d.element]), 18)} ${d.name}`;
    this.q('#hud-name').style.color = hex(ELEMENT_COLOR[d.element]);
    this.q('#hud-title').textContent = d.title;
  }

  setCompanions(names: string[]): void {
    if (names.join('|') === this.companions.join('|')) return;
    this.companions = names;
    this.q('#hud-companions').innerHTML = names.map((n) => `<div class="hud-comp panel">⚔ ${n}</div>`).join('');
  }

  setStamina(value: number, max: number): void {
    const f = value / max;
    this.q('#hud-stamina').style.width = `${Math.round(f * 100)}%`;
    this.q('#hud-stamina-wrap').style.opacity = f < 0.999 ? '1' : '0';
  }

  /** The title screen's call to action. */
  setPress(text: string): void {
    this.q('#hud-press').textContent = text;
  }

  setLocked(locked: boolean): void {
    this.q('#hud-prompt').style.display = locked || this.panel !== 'none' ? 'none' : 'flex';
    this.root.classList.toggle('locked', locked);
  }

  // ---------- panels ----------
  private open(panel: Panel): void {
    this.panel = panel;
    const el = this.q('#hud-dialog');
    el.style.display = panel === 'none' ? 'none' : 'block';
    this.root.classList.toggle('panel-open', panel !== 'none');
  }

  close(): void {
    this.open('none');
    this.talkNpc = null;
    this.lastNode = null;
  }

  /** The number keys pick a conversation's answers (1 = the first). */
  pickChoice(n: number): boolean {
    if (this.panel !== 'talk') return false;
    const b = this.q('#hud-dialog').querySelector<HTMLButtonElement>(`button[data-act="c${n - 1}"]`);
    if (!b) return false;
    b.click();
    return true;
  }

  talk(npc: NpcDef): void {
    this.talkNpc = npc;
    this.talkLine = 0;
    this.lastNode = null;
    this.open('talk');
    this.renderTalk();
  }

  private renderTalk(): void {
    const npc = this.talkNpc!;
    const el = this.q('#hud-dialog');
    const buttons: string[] = [];
    if (this.talkLine < npc.lines.length - 1) buttons.push(`<button data-act="next">Next</button>`);
    if (npc.shop) buttons.push(`<button data-act="shop">Trade</button>`);
    if (npc.hire && !this.hired.has(npc.id)) buttons.push(`<button data-act="hire">Hire · ◆ ${npc.hire.cost}</button>`);
    buttons.push(`<button data-act="close">Leave</button>`);
    el.innerHTML = `<div class="dlg-head"><div class="dlg-name">${npc.name}</div><div class="dlg-title">${npc.title}</div></div>
      <div class="dlg-line">“${npc.lines[this.talkLine]}”</div>
      <div class="dlg-buttons">${buttons.join('')}</div>`;
    this.wire(el, (act) => {
      if (act === 'next') { this.talkLine++; this.renderTalk(); }
      else if (act === 'shop') this.renderShop();
      else if (act === 'hire') {
        const r = this.actions!.onHire(npc);
        if (r === 'ok') this.hired.add(npc.id);
        this.renderTalkResult(r === 'ok' ? '“Lead on. I follow.”' : r === 'full' ? '“You already have three at your back. Come for me another time.”' : '“Come back when your purse is heavier.”');
      }
      else this.actions!.onClose();
    });
  }

  /**
   * A conversation with choices (game/Dialogue). `head` names the speaker (an NPC def, so Trade and its ordinary
   * lines are reachable). `onLine` runs as each line opens (its voice).
   */
  dialogue(head: NpcDef | { name: string; title: string }, node: DialogueNode, onLine?: (node: DialogueNode) => void): void {
    this.talkNpc = 'lines' in head ? head : null;
    this.open('talk');
    this.renderNode(head, node, onLine);
  }

  private renderNode(head: { name: string; title: string }, node: DialogueNode, onLine?: (node: DialogueNode) => void): void {
    onLine?.(node);
    this.lastNode = { head, node };
    const el = this.q('#hud-dialog');
    el.innerHTML = `<div class="dlg-head"><div class="dlg-name">${head.name}</div><div class="dlg-title">${head.title}</div></div>
      <div class="dlg-line">“${node.line}”</div>
      <div class="dlg-choices">${node.choices.map((c, i) => `<button data-act="c${i}"><span class="dlg-choice-n">${i + 1}</span>${c.label}</button>`).join('')}</div>`;
    this.wire(el, (act) => {
      const choice = node.choices[Number(act.slice(1))];
      const step = choice?.run ? choice.run() : 'close';
      if (step === 'close') this.actions!.onClose();
      else if (step === 'trade' && this.talkNpc) this.renderShop();
      else if (typeof step === 'object') this.renderNode(head, step, onLine);
      else this.actions!.onClose();
    });
  }

  private renderTalkResult(line: string): void {
    const npc = this.talkNpc!;
    const el = this.q('#hud-dialog');
    el.innerHTML = `<div class="dlg-head"><div class="dlg-name">${npc.name}</div><div class="dlg-title">${npc.title}</div></div>
      <div class="dlg-line">${line}</div><div class="dlg-buttons"><button data-act="close">Leave</button></div>`;
    this.wire(el, () => this.actions!.onClose());
  }

  private renderShop(): void {
    const npc = this.talkNpc!;
    const inv = this.inventory!;
    this.open('shop');
    const el = this.q('#hud-dialog');
    const buy = (npc.shop ?? []).map((s) => {
      const d = ITEMS[s.itemId];
      return `<div class="row"><span class="item r${d.rarity}">${d.name}</span><span class="desc">${d.desc}</span><button data-act="buy" data-id="${s.itemId}" data-price="${s.price}" ${inv.shards < s.price ? 'disabled' : ''}>Buy ◆ ${s.price}</button></div>`;
    }).join('');
    // (Quest keys are never for sale.)
    const sell = inv.entries.filter((e) => !e.equippedBy && ITEMS[e.itemId].kind !== 'key').map((e) => {
      const d = ITEMS[e.itemId];
      return `<div class="row"><span class="item r${d.rarity}">${d.name}${e.count > 1 ? ` ×${e.count}` : ''}</span><span class="desc">${RARITY_NAME[d.rarity]}</span><button data-act="sell" data-uid="${e.uid}">Sell ◆ ${d.value}</button></div>`;
    }).join('') || '<div class="empty">Nothing to sell.</div>';
    el.innerHTML = `<div class="dlg-head"><div class="dlg-name">${npc.name}</div><div class="dlg-title">Trade · you have ◆ ${inv.shards}</div></div>
      <div class="shop-cols"><div><div class="col-title">Buy</div>${buy}</div><div><div class="col-title">Sell</div>${sell}</div></div>
      <div class="dlg-buttons"><button data-act="back">Back</button><button data-act="close">Leave</button></div>`;
    this.wire(el, (act, b) => {
      if (act === 'buy') { if (this.actions!.onBuy(b.dataset.id!, Number(b.dataset.price))) this.renderShop(); }
      else if (act === 'sell') { this.actions!.onSell(Number(b.dataset.uid), 1); this.renderShop(); }
      // Back to where the conversation was (its choices), or to the NPC's ordinary lines.
      else if (act === 'back') { this.open('talk'); if (this.lastNode) this.renderNode(this.lastNode.head, this.lastNode.node); else this.renderTalk(); }
      else this.actions!.onClose();
    });
  }

  inventoryPanel(): void {
    this.open('inventory');
    this.renderInventory();
  }

  private renderInventory(): void {
    const inv = this.inventory!;
    const me = this.activeChar!;
    const heroName = (id: string) => ROSTER.find((c) => c.id === id)?.name ?? id;
    const el = this.q('#hud-dialog');
    const groups: Record<string, string[]> = { weapon: [], consumable: [], charm: [], key: [], material: [] };
    for (const e of inv.entries) {
      const d = ITEMS[e.itemId];
      const stats = d.atk ? `+${d.atk} ATK${d.element ? ` · ${d.element}` : ''} · ${d.weaponClass}` : d.heal ? `heals ${d.heal}` : d.dmgMult ? `+${Math.round((d.dmgMult - 1) * 100)}% damage` : RARITY_NAME[d.rarity];
      let btn = '';
      if (d.kind === 'weapon') btn = e.equippedBy ? `<span class="tag">equipped by ${heroName(e.equippedBy)}</span>` : `<button data-act="equip" data-uid="${e.uid}" ${canWield(me.weapon, d.weaponClass) ? '' : 'disabled'}>Equip on ${me.name}</button>`;
      else if (d.kind === 'consumable') btn = `<button data-act="use" data-uid="${e.uid}">Use</button>`;
      if (!e.equippedBy && d.kind !== 'key') btn += `<button class="ghost" data-act="drop" data-uid="${e.uid}">Drop</button>`;
      groups[d.kind].push(`<div class="row"><span class="item r${d.rarity}">${d.name}${e.count > 1 ? ` ×${e.count}` : ''}</span><span class="desc">${stats}</span><span class="btns">${btn}</span></div>`);
    }
    const section = (title: string, rows: string[]) => rows.length ? `<div class="col-title">${title}</div>${rows.join('')}` : '';
    el.innerHTML = `<div class="dlg-head"><div class="dlg-name">Satchel</div><div class="dlg-title">◆ ${inv.shards} Moon Shards · ${me.name} wields a ${me.weapon}</div></div>
      <div class="inv-list">${section('Weapons', groups.weapon)}${section('Consumables', groups.consumable)}${section('Charms', groups.charm)}${section('Keys', groups.key)}${section('Materials', groups.material)}${inv.entries.length ? '' : '<div class="empty">Empty. The fog owes you nothing yet.</div>'}</div>
      <div class="dlg-buttons"><button data-act="close">Close (I)</button></div>`;
    this.wire(el, (act, b) => {
      if (act === 'equip') { this.actions!.onEquip(Number(b.dataset.uid)); this.renderInventory(); }
      else if (act === 'use') { this.actions!.onUse(Number(b.dataset.uid)); this.renderInventory(); }
      else if (act === 'drop') { this.actions!.onDrop(Number(b.dataset.uid)); this.renderInventory(); }
      else this.actions!.onClose();
    });
  }

  private wire(el: HTMLElement, handler: (act: string, button: HTMLButtonElement) => void): void {
    el.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((b) => {
      b.addEventListener('click', (ev) => { ev.stopPropagation(); handler(b.dataset.act!, b); });
    });
  }
}
