#!/usr/bin/env node
/**
 * Adds CC0 sound effects to public/audio/sfx/ without redoing the rest (v12, 2026-11-16: the explosions, the fire's
 * crackle and the tornado's wind). Same processing as scripts/sfx-import.mjs (mono AAC .m4a, -16 LUFS); loops keep
 * their head (no silence trim) and are cut to LOOP_S. Replaces only its own categories in manifest.json and their lines
 * in docs/reference/sfx-credits.md.
 *
 *   node scripts/sfx-add.mjs <kenney sci-fi sounds dir> <fire.wav> <wind woosh loop.ogg>
 * The Kenney dir is the unzipped pack (its License.txt must say CC0); the two OpenGameArt files were checked CC0 on
 * their pages (URLs below) when downloaded.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const [scifi, fireWav, windOgg] = process.argv.slice(2);
if (!scifi || !fireWav || !windOgg) { console.error('usage: node scripts/sfx-add.mjs <sci-fi sounds dir> <fire.wav> <wind woosh loop.ogg>'); process.exit(1); }
if (!/CC0|Creative Commons Zero/i.test(readFileSync(join(scifi, 'License.txt'), 'utf8'))) { console.error(`${scifi}: License.txt does not say CC0`); process.exit(1); }

const LOOP_S = 20;
const OUT = 'public/audio/sfx';
const NORM = 'loudnorm=I=-16:TP=-1.5:LRA=11';
/** category → [{ src, out, name, url, loop }]. */
const ADD = {
  explosion: readdirSync(join(scifi, 'Audio')).filter((f) => /^(explosionCrunch|lowFrequency_explosion)_\d+\.ogg$/.test(f)).sort()
    .map((f) => ({ src: join(scifi, 'Audio', f), out: basename(f, '.ogg') + '.m4a', name: `Kenney Sci-Fi Sounds 1.0 (${f})`, url: 'https://kenney.nl/assets/sci-fi-sounds', loop: false })),
  'fire-loop': [{ src: fireWav, out: 'fire.m4a', name: 'fireplace sound loop by pagdev (fire.wav)', url: 'https://opengameart.org/content/fireplace-sound-loop', loop: true }],
  'wind-loop': [{ src: windOgg, out: 'wind-woosh.m4a', name: 'wind whoosh loop by SketchMan3 (wind woosh loop.ogg)', url: 'https://opengameart.org/content/wind-whoosh-loop', loop: true }],
};

const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
let credits = readFileSync('docs/reference/sfx-credits.md', 'utf8').trimEnd().split('\n');
let bytes = 0;
for (const [cat, files] of Object.entries(ADD)) {
  rmSync(join(OUT, cat), { recursive: true, force: true });
  mkdirSync(join(OUT, cat), { recursive: true });
  credits = credits.filter((l) => !l.startsWith(`| ${cat}/`));
  manifest[cat] = [];
  for (const f of files) {
    const out = join(OUT, cat, f.out);
    const af = f.loop ? `${NORM},afade=t=out:st=${LOOP_S - 0.5}:d=0.5` : `silenceremove=start_periods=1:start_threshold=-50dB,${NORM}`;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f.src, ...(f.loop ? ['-t', String(LOOP_S)] : []), '-ac', '1', '-ar', '44100', '-af', af, '-c:a', 'aac', '-b:a', '64k', out]);
    bytes += readFileSync(out).length;
    manifest[cat].push(f.out);
    credits.push(`| ${cat}/${f.out} | ${f.name} | CC0 1.0 | ${f.url} |`);
  }
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
writeFileSync('docs/reference/sfx-credits.md', credits.join('\n') + '\n');
console.log(`sfx-add: ${Object.values(ADD).flat().length} files in ${Object.keys(ADD).length} categories, ${(bytes / 1024).toFixed(0)} KB`);
