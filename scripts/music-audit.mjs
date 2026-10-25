#!/usr/bin/env node
/**
 * The music licence guard (part of `npm run build`): only src/assets/music/licensed/ ships (music.ts globs that
 * folder alone), and only with a credit line per track in its LICENSES.md, in the form
 * '<file name> — <licence> — <source url> — <credit line>'. A media file in licensed/ without a line, or with an
 * incomplete one, fails the build. Media files directly in src/assets/music/ are not bundled: they are named in a
 * warning so nobody expects them to play, and the build goes on.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MUSIC = fileURLToPath(new URL('../src/assets/music/', import.meta.url));
const LICENSED = join(MUSIC, 'licensed');
const LICENSES = join(LICENSED, 'LICENSES.md');
/** The formats music.ts picks up. */
const MEDIA = /\.(mp3|m4a|aac|ogg|opus|wav|flac|webm)$/i;
/** The slots music.ts knows (a licensed file with another name plays nowhere). */
const SLOTS = ['title-intro', 'title-loop', 'kingdom'];

const mediaIn = (dir) => (existsSync(dir) ? readdirSync(dir).filter((n) => MEDIA.test(n) && statSync(join(dir, n)).isFile()).sort() : []);

/** The credit lines by file name. Fenced code and lines whose first field is not a media file name are not entries. */
function readLicenses() {
  const entries = new Map();
  const malformed = [];
  if (!existsSync(LICENSES)) return { entries, malformed, present: false };
  let fenced = false;
  for (const raw of readFileSync(LICENSES, 'utf8').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```')) { fenced = !fenced; continue; }
    if (fenced || !line.includes('—')) continue;
    const fields = line.replace(/^[-*]\s+/, '').split(/\s+—\s+/).map((f) => f.replace(/^`|`$/g, '').trim());
    if (!MEDIA.test(fields[0])) continue;
    if (fields.length < 4 || fields.some((f) => !f)) { malformed.push(line); continue; }
    entries.set(fields[0], fields);
  }
  return { entries, malformed, present: true };
}

const shipped = mediaIn(LICENSED);
const parked = mediaIn(MUSIC);
const { entries, malformed, present } = readLicenses();

const errors = [];
if (shipped.length && !present) errors.push('src/assets/music/licensed/LICENSES.md is missing');
for (const file of shipped) if (!entries.has(file)) errors.push(`licensed/${file} has no line in src/assets/music/licensed/LICENSES.md`);
for (const line of malformed) errors.push(`LICENSES.md line needs four fields, '<file name> — <licence> — <source url> — <credit line>': ${line}`);

if (parked.length) {
  console.warn(`music audit: ${parked.length} media file(s) sit directly in src/assets/music/ and do NOT ship (only src/assets/music/licensed/ is bundled; they stay out of the game and out of git):`);
  for (const f of parked) console.warn('  ' + f);
}
for (const file of shipped) {
  const slot = file.replace(/\.[^.]+$/, '');
  if (!SLOTS.includes(slot)) console.warn(`music audit: licensed/${file} is not named after a slot (${SLOTS.join(', ')}), so it will not play`);
}
for (const file of entries.keys()) if (!shipped.includes(file)) console.warn(`music audit: LICENSES.md names ${file}, which is not in licensed/`);

if (errors.length) {
  console.error('Music in src/assets/music/licensed/ without a licence line cannot ship (see src/assets/music/README.md):');
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`music audit: clean (${shipped.length} licensed track(s) ship; ${parked.length} parked file(s) do not)`);
