/** Palette tokens — the contract from .claude/skills/ginseng-impact-design. */
export const PALETTE = {
  void: 0x05060f,
  abyss: 0x0a0f2e,
  cobalt: 0x1a2cff,
  ultramarine: 0x2b3fd9,
  electric: 0x4f7cff,
  moon: 0xdfe6ff,
  blood: 0xff2a2a,
  rune: 0x37f5ff,
  witch: 0x5dff3a,
  dusk: 0x8b3dff,
  fog: 0x1b2a6b,
  stone: 0x46538c,
  bark: 0x2a2f55,
  cloth: 0x8d99d6,
} as const;

export type PaletteToken = keyof typeof PALETTE;
