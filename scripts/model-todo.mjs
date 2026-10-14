#!/usr/bin/env node
/**
 * Reads the model registry (src/data/models.ts) and prints the Meshy to-do list: every entry whose GLB is
 * missing from public/models. `--readme` rewrites public/models/README.md from the same table.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/data/models.ts', import.meta.url), 'utf8');
// Entries are `id: stat('file', height, 'label')` or `id: { file: '…', height: n, …, label: '…' }`; several may share a line.
const re = /(?:^|,)\s*'?([\w-]+)'?:\s*(?:stat\('([^']+)',\s*([\d.]+),\s*'([^']+)'\)|\{\s*file:\s*'([^']+)',\s*height:\s*([\d.]+)(?:[^}]*?label:\s*'([^']+)')?)/gm;
const rows = [];
let m;
while ((m = re.exec(src))) {
  const file = m[2] ?? m[5];
  rows.push({ id: m[1], file, height: m[3] ?? m[6], label: m[4] ?? m[7] ?? '', present: existsSync(new URL(`../public/models/${file}`, import.meta.url)) });
}
const missing = rows.filter((r) => !r.present);
const files = new Set(missing.map((r) => r.file));

if (process.argv.includes('--readme')) {
  const table = ['| id | file | height (m) | what | status |', '|---|---|---|---|---|', ...rows.map((r) => `| \`${r.id}\` | ${r.file} | ${r.height} | ${r.label} | ${r.present ? 'present' : 'to generate'} |`)].join('\n');
  writeFileSync(new URL('../public/models/README.md', import.meta.url), `# Real 3D models (Meshy only)

Every structure, creature, NPC and plant in Ginseng Impact is a Meshy export placed by its registry id
(\`src/data/models.ts\`). Nothing is built procedurally any more: a missing file shows a small glowing marker
(structures, characters, enemies) or nothing at all (instanced flora), and the browser console warns once
per missing id at startup. \`npm run todo:models\` prints the same list; \`npm run audit:procedural\` (part of
\`npm run build\`) fails if procedural geometry comes back.

Pipeline (Meshy Pro): image-to-3D from \`docs/reference/frames/\` (texture on, A-pose for humanoids) or
text-to-3D + image-guided texture → remesh at 30K → Humanoid rig with presets (free) or static → Download
glb ("All added", "One file") → \`node scripts/model-tools.mjs optimize <download.glb> public/models/<file>\`.
Models should face +X; set \`yaw\` in the registry if a file faces another way. Clip names match by substring
with alternatives (\`"slam|attack|punch"\`).

${rows.length} registered, ${rows.length - missing.length} present, ${files.size} files to generate (${missing.length} ids).

${table}
`);
  console.log('public/models/README.md regenerated');
}

console.log(`${rows.length} registered models, ${rows.length - missing.length} present, ${files.size} files still to generate on Meshy (${missing.length} ids):\n`);
for (const r of missing) console.log(`- ${r.id.padEnd(18)} ${r.file.padEnd(24)} ${String(r.height).padStart(5)} m  ${r.label}`);
