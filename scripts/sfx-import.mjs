#!/usr/bin/env node
/**
 * Imports CC0 sound effects into public/audio/sfx/<category>/ (quality pass of 2026-11-16, the user's choice of
 * recorded free sounds): trims silence, loudness-normalises to -16 LUFS, mono AAC (.m4a, plays in every browser),
 * writes public/audio/sfx/manifest.json (category → files) and docs/reference/sfx-credits.md (one line per file:
 * source, licence, URL). scripts/music-audit.mjs fails the build for a file in public/audio/sfx with no CC0 line.
 *
 *   node scripts/sfx-import.mjs <kenney-impact-sounds dir> <kenney-rpg-audio dir>
 * Each dir is an unzipped Kenney pack (its License.txt must say CC0).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const [impactDir, rpgDir] = process.argv.slice(2);
if (!impactDir || !rpgDir) { console.error('usage: node scripts/sfx-import.mjs <impact-sounds dir> <rpg-audio dir>'); process.exit(1); }

const PACKS = {
  impact: { dir: impactDir, name: 'Kenney Impact Sounds 1.0', url: 'https://kenney.nl/assets/impact-sounds' },
  rpg: { dir: rpgDir, name: 'Kenney RPG Audio', url: 'https://kenney.nl/assets/rpg-audio' },
};
for (const p of Object.values(PACKS)) {
  const lic = readFileSync(join(p.dir, 'License.txt'), 'utf8');
  if (!/CC0|Creative Commons Zero/i.test(lic)) { console.error(`${p.dir}: License.txt does not say CC0`); process.exit(1); }
}

/** category → [pack, filename regex]. */
const MAP = {
  'hit-flesh': [['impact', /^impactPunch_(medium|heavy)_/], ['impact', /^impactSoft_heavy_/]],
  'hit-metal': [['impact', /^impactMetal_(medium|heavy)_/], ['impact', /^impactPlate_(medium|heavy)_/]],
  'hit-wood': [['impact', /^impactWood_(medium|heavy)_/], ['impact', /^impactPlank_medium_/]],
  'hit-stone': [['impact', /^impactMining_/], ['impact', /^impactPlate_light_/]],
  'hit-glass': [['impact', /^impactGlass_(medium|heavy)_/]],
  'step-grass': [['impact', /^footstep_grass_/]],
  'step-stone': [['impact', /^footstep_concrete_/]],
  'step-wood': [['impact', /^footstep_wood_/]],
  'step-snow': [['impact', /^footstep_snow_/]],
  'cloth': [['rpg', /^cloth\d/], ['rpg', /^clothBelt\d/]],
  'blade-draw': [['rpg', /^drawKnife\d/]],
  'slice': [['rpg', /^knifeSlice\d?/]],
  'chop': [['rpg', /^chop\.ogg$/], ['impact', /^impactWood_heavy_/]],
  'coins': [['rpg', /^handleCoins\d?/]],
  'creak': [['rpg', /^creak\d/]],
};

const OUT = 'public/audio/sfx';
rmSync(OUT, { recursive: true, force: true });
const manifest = {};
const credits = [
  '# Sound effect credits',
  '',
  'Every file in `public/audio/sfx` (written by `scripts/sfx-import.mjs`). `scripts/music-audit.mjs` fails the build',
  'for a file with no line here, or a line without a CC0 licence.',
  '',
  '| File | Source | Licence | URL |',
  '|---|---|---|---|',
];
let bytes = 0;
for (const [cat, rules] of Object.entries(MAP)) {
  mkdirSync(join(OUT, cat), { recursive: true });
  manifest[cat] = [];
  for (const [pack, re] of rules) {
    const p = PACKS[pack];
    const audio = join(p.dir, 'Audio');
    for (const f of readdirSync(audio).filter((n) => n.endsWith('.ogg') && re.test(n)).sort()) {
      const out = join(OUT, cat, basename(f, '.ogg') + '.m4a');
      if (existsSync(out)) continue;
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(audio, f), '-ac', '1', '-ar', '44100',
        '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-16:TP=-1.5:LRA=11',
        '-c:a', 'aac', '-b:a', '64k', out]);
      bytes += readFileSync(out).length;
      manifest[cat].push(basename(out));
      credits.push(`| ${cat}/${basename(out)} | ${p.name} (${f}) | CC0 1.0 | ${p.url} |`);
    }
  }
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
writeFileSync('docs/reference/sfx-credits.md', credits.join('\n') + '\n');
console.log(`sfx-import: ${Object.values(manifest).flat().length} files in ${Object.keys(manifest).length} categories, ${(bytes / 1024).toFixed(0)} KB`);
