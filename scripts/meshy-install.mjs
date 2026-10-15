#!/usr/bin/env node
/**
 * Installs the newest Meshy export in ~/Downloads whose name contains <key> as public/models/<file>,
 * optimized (WebP textures, simplified to <targetTriangles>).
 *   node scripts/meshy-install.mjs <key> <file.glb> [targetTriangles=30000] [maxTexture=1024]
 */
import { readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Paths below are relative to the repository root, wherever the script is run from.
process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const [key, file, tris = '30000', tex = '1024'] = process.argv.slice(2);
if (!key || !file) { console.error('usage: meshy-install.mjs <key> <file.glb> [tris] [tex]'); process.exit(2); }
const dir = join(homedir(), 'Downloads');
const hits = readdirSync(dir).filter((f) => f.startsWith('Meshy_AI_') && f.endsWith('.glb') && f.includes(key))
  .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
if (!hits.length) { console.error(`no download matching "${key}"`); process.exit(1); }
const src = join(dir, hits[0].f);
const out = `public/models/${file}`;
execFileSync('node', ['scripts/model-tools.mjs', 'optimize', src, out, tex, tris], { stdio: 'inherit' });
execFileSync('node', ['scripts/model-tools.mjs', 'info', out], { stdio: 'inherit' });
