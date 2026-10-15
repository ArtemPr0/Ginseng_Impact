// node scripts/voices.mjs [--force] [id ...]: renders src/data/voices.ts lines to public/audio/<id>.mp3 with macOS
// `say` and ffmpeg (pitch via asetrate, tempo restored with atempo, then the line's fx). Skips existing files.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));
const { VOICES } = await import('../src/data/voices.ts');
const tmp = mkdtempSync(join(tmpdir(), 'voices-'));
let made = 0;
for (const [id, v] of Object.entries(VOICES)) {
  if (only.length && !only.includes(id)) continue;
  const out = `public/audio/${id}.mp3`;
  if (existsSync(out) && !force) continue;
  const aiff = join(tmp, `${id}.aiff`);
  execFileSync('say', ['-v', v.voice, '-r', String(v.rate), '-o', aiff, v.text]);
  // atempo accepts 0.5..2: chain two for wider ranges.
  const tempo = 1 / v.pitch;
  const atempo = tempo < 0.5 ? `atempo=${Math.sqrt(tempo)},atempo=${Math.sqrt(tempo)}` : `atempo=${tempo}`;
  const sr = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate', '-of', 'default=nw=1:nk=1', aiff]).toString().trim()) || 22050;
  const chain = [`asetrate=${sr}*${v.pitch}`, 'aresample=44100', atempo, v.fx, 'loudnorm=I=-16:TP=-1.5'].filter(Boolean).join(',');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, '-af', chain, '-ac', '1', '-ar', '44100', '-b:a', '64k', out]);
  made++;
  console.log('voice', id);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`voices: ${made} rendered`);
