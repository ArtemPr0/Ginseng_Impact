import type { Element } from '../combat/Elements';

const paths: Record<Element, string> = {
  lunar: '<path d="M13.5 3.5a7 7 0 1 0 3 12.6 6 6 0 1 1-3-12.6z"/>',
  blood: '<path d="M10 2.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10z"/>',
  astral: '<path d="M10 2l1.8 6.2L18 10l-6.2 1.8L10 18l-1.8-6.2L2 10l6.2-1.8z"/>',
  fog: '<path d="M10 10a2 2 0 1 0 2-2 4 4 0 1 0 2 4 6 6 0 1 1-4-6"/>',
  stone: '<path d="M10 2.5l6.5 3.75v7.5L10 17.5l-6.5-3.75v-7.5z"/>',
  rot: '<path d="M3 17C3 8 9 3 17 3c0 8-5 14-14 14zM3 17L17 3"/>',
  tide: '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 7c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
};

/** Inline SVG line icon for an element, 1.5 px stroke in `color`. */
export function glyph(element: Element, color: string, size = 16): string {
  return `<svg class="glyph" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${paths[element]}</svg>`;
}
