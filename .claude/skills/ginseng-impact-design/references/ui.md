# HUD and menus

The HUD is a DOM overlay on top of the low-res 3D. It stays crisp while the world stays chunky.
Layout mirrors Genshin so a Genshin player's hands already know it; skin is dark-fantasy.

## Type

- Titles, names, damage numbers: **Cinzel** (Google Fonts), uppercase, letter-spacing 0.08em.
- Body, numbers in bars, tooltips: **Inter** 13–14 px.
- Colour: `moon` on `panel`. Never pure white (`#fff`); never grey text.

## Panels

```css
.panel {
  background: var(--panel);                 /* rgba(10,15,46,.72) */
  border: 1px solid var(--panel-border);    /* rgba(223,230,255,.25) */
  border-radius: 2px;                        /* sharp; max 2px */
  box-shadow: inset 0 0 12px rgba(26,44,255,.25); /* cobalt inner glow, no drop shadow */
  backdrop-filter: none;                     /* blur reads as modern; forbidden */
}
```

## Colour semantics

| Meaning | Token |
|---|---|
| HP, danger, Blood element | `blood` |
| Skill ready, Tide | `rune` |
| Selected / active character, stamina | `electric` |
| Neutral text, moon, Lunar | `moon` |
| Astral, magic | `dusk` |
| Poison, Rot | `witch` |
| Disabled / cooldown fill | `abyss` |

## Layout (1920×1080 reference; scale with `vh`)

| Region | Content |
|---|---|
| top-left | circular minimap, 160 px, `panel`, player as `electric` chevron, enemies as `blood` dots |
| right-centre | party column: 3 portraits 72 px, active one scaled 1.15 with `electric` border; key hint `1 2 3` |
| bottom-centre | active character name (Cinzel) + HP bar (`blood` fill on `abyss`), stamina arc appears only while draining |
| bottom-right | skill circle (E) 72 px and burst circle (Q) 96 px; cooldown as radial `abyss` sweep; ready state gets a `rune` ring |
| above enemies | 4 px HP bar `blood` on `void`, element aura rune glyph above it |
| centre | 2 px `moon` crosshair dot, hidden while not attacking |

## Element glyphs

Inline SVG line icons, 1.5 px stroke, 20×20 viewBox, stroke in the element's primary token:
Lunar crescent · Blood drop · Astral 4-point star · Fog spiral · Stone hexagon · Rot leaf · Tide wave.

## Motion

- Transitions are **stepped**: ≤ 120 ms, `steps(3)` or linear. No springs, no ease-out tails.
- Fades are dither-fades (`opacity` in 4 steps), not smooth alpha.
- Damage numbers: Cinzel 22 px in element colour, scale 1.3→1 in 80 ms, drift up 20 px over 600 ms, then vanish.

## Title screen

Wordmark `GINSENG IMPACT` in Cinzel 72 px, letter-spacing 0.3em, `moon` with a 1 px `electric`
outline; silver moon behind the wordmark; causeway and head in the background scene with the camera
slowly pushing forward; single prompt `PRESS ANY KEY` blinking at 1 Hz, stepped.

## Don'ts

- No rounded pills, no gradients on buttons, no glassmorphism blur, no drop shadows.
- No gold. Genshin's gold/white UI is the one thing we do not copy.
- No emoji icons.
