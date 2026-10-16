# Palette — Ginseng Impact

Token names are the contract. Use them in CSS custom properties, Three.js constants and prose.
Never introduce a new hue without adding a token here.

## Tokens

| Token | Hex | Role | Where it appears in the reels |
|---|---|---|---|
| `void` | `#05060f` | clear colour, deepest shadow, HUD backdrop | cave interiors, silhouettes |
| `abyss` | `#0a0f2e` | base navy: sky zenith, shadowed ground, panel fill | every frame's dark half |
| `cobalt` | `#1a2cff` | the signature blue: sky mid-band, distant terrain, bounce light | cathedral-in-clouds sky, causeway sky |
| `ultramarine` | `#2b3fd9` | lit mid-tone surfaces, stone in moonlight | giant head, bridge stones |
| `electric` | `#4f7cff` | highlights, rim light, moonlit edges, glowing flora core | sunflower petals, cliff rims |
| `moon` | `#dfe6ff` | moon disc, HUD text, brightest specular | silver moon, waterfall |
| `blood` | `#ff2a2a` | glowing eyes, blood moon, Blood element, danger | stone-head eyes, beast eyes, red moon |
| `rune` | `#37f5ff` | cyan emissive: portal fire, runes, skill-ready, Tide | cathedral doorway flame |
| `witch` | `#5dff3a` | acid green: witches, poison, Rot element | witch scene, glowing moss |
| `dusk` | `#8b3dff` | violet dusk sky, Astral element, magic | pink-violet sky behind castle |
| `fog` | `#1b2a6b` | FogExp2 colour, cloud sea, horizon band | every fog layer |

## Surface tokens (derived, for low-poly materials)

| Token | Hex | Use |
|---|---|---|
| `stone` | `#46538c` | base colour of stone meshes before lighting |
| `bark` | `#2a2f55` | tree trunks, dead wood, dark armour |
| `cloth` | `#8d99d6` | capes and robes before lighting |

## Proportions in a frame

- 70%: `void` + `abyss` + `cobalt` + `fog`
- 20%: `ultramarine` + `electric` + `moon`
- 10%: accents. `blood` must stay under ~2% of pixels; it is a focal point, not a fill.

## Element → colour

| Element (Genshin) | Primary | Secondary |
|---|---|---|
| Lunar (Cryo) | `moon` | `electric` |
| Blood (Pyro) | `blood` | `void` |
| Astral (Electro) | `dusk` | `witch` |
| Fog (Anemo) | `fog` | `electric` |
| Stone (Geo) | `ultramarine` | `stone` |
| Rot (Dendro) | `witch` | `bark` |
| Tide (Hydro) | `rune` | `cobalt` |

## CSS

```css
:root {
  --void: #05060f; --abyss: #0a0f2e; --cobalt: #1a2cff; --ultramarine: #2b3fd9;
  --electric: #4f7cff; --moon: #dfe6ff; --blood: #ff2a2a; --rune: #37f5ff;
  --witch: #5dff3a; --dusk: #8b3dff; --fog: #1b2a6b;
  --stone: #46538c; --bark: #2a2f55; --cloth: #8d99d6;
  --panel: rgba(10, 15, 46, 0.72);
  --panel-border: rgba(223, 230, 255, 0.25);
}
```

## Three.js

```ts
export const PALETTE = {
  void: 0x05060f, abyss: 0x0a0f2e, cobalt: 0x1a2cff, ultramarine: 0x2b3fd9,
  electric: 0x4f7cff, moon: 0xdfe6ff, blood: 0xff2a2a, rune: 0x37f5ff,
  witch: 0x5dff3a, dusk: 0x8b3dff, fog: 0x1b2a6b,
  stone: 0x46538c, bark: 0x2a2f55, cloth: 0x8d99d6,
} as const;
```

## Since round 5 (2026-10-16): warm accents and the trip palette

The user's reference frame (`world-look-28.png`) has warm torch flames, candle-lit windows and an orange swirl in
the eye vortex, so the old "zero warm colour" rule is retired. What stays: warm only as small points.

| Accent | Value | Where |
|---|---|---|
| Fire | `FIRE` (`src/world/Fire.ts`) | torches, candles, braziers, burning castles |
| Lit window | `(1.0, 0.55, 0.18)` emissive | `patchLitWindows` on houses |
| Trip palette | cosine palette `0.5 + 0.5·cos(2π(t + (0, 0.33, 0.67)))` | the eye vortex, the dream, the Prism Wizard |
| Graveyard storm | cloud lit `#d88a2a`, fog `#2a1446` | the Alley of Graves only |
