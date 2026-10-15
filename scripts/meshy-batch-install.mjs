#!/usr/bin/env node
/**
 * Installs finished Meshy downloads by registry id. Meshy names a download after the first 21 characters of its
 * prompt, so the prompt in docs/reference/meshy-queue.json (or `--prompt id=text` overrides) finds the file; the
 * registry (src/data/models.ts) gives the target file name.
 *   node scripts/meshy-batch-install.mjs <id>[:targetTriangles] ... [--prompt id=text]
 * Rigged exports (…_All_Animations.glb) are installed without simplification.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Paths below are relative to the repository root, wherever the script is run from.
process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const args = process.argv.slice(2);
const overrides = {};
const ids = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--prompt') { const [k, ...v] = args[++i].split('='); overrides[k] = v.join('='); }
  else ids.push(args[i]);
}
const queue = JSON.parse(readFileSync(new URL('../docs/reference/meshy-queue.json', import.meta.url), 'utf8'));
const prompts = {};
for (const t of queue.tiers) for (const it of t.items) prompts[it.id] = it.prompt;
Object.assign(prompts, overrides);
const src = readFileSync(new URL('../src/data/models.ts', import.meta.url), 'utf8');
const files = {};
const re = /(?:^|,)\s*'?([\w-]+)'?:\s*(?:\{\s*\.\.\.)?(?:stat\('([^']+)'|\{\s*file:\s*'([^']+)')/gm;
let m;
while ((m = re.exec(src))) files[m[1]] = m[2] ?? m[3];
const dir = join(homedir(), 'Downloads');
const downloads = readdirSync(dir).filter((f) => f.startsWith('Meshy_AI_') && f.endsWith('.glb')).map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
for (const spec of ids) {
  const [id, tris = '30000'] = spec.split(':');
  const file = files[id];
  const prompt = prompts[id];
  if (!file || !prompt) { console.log(`✗ ${id}: ${!file ? 'not in the registry' : 'no prompt'}`); continue; }
  const key = 'Meshy_AI_' + prompt.slice(0, 21).replace(/[^A-Za-z0-9]/g, '_');
  const hit = downloads.find((d) => d.f.startsWith(key));
  if (!hit) { console.log(`✗ ${id}: no download starting with ${key}`); continue; }
  const rigged = hit.f.includes('All_Animations');
  const out = execFileSync('node', ['scripts/model-tools.mjs', 'optimize', join(dir, hit.f), `public/models/${file}`, '1024', rigged ? '0' : tris], { encoding: 'utf8' });
  const info = execFileSync('node', ['scripts/model-tools.mjs', 'info', `public/models/${file}`], { encoding: 'utf8' });
  console.log(`✓ ${id} → ${file}: ${out.trim().split('\n').pop().replace(/.*→/, '→')} | ${info.split('\n')[1].trim()}${rigged ? ' | ' + info.split('\n')[2].trim().slice(0, 140) : ''}`);
}
