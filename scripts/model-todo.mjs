#!/usr/bin/env node
/** Prints the Meshy to-do list: every registry entry whose file is missing from public/models. */
import { existsSync, readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/data/models.ts', import.meta.url), 'utf8');
const re = /^\s*'?([\w-]+)'?:\s*(?:stat\('([^']+)',\s*([\d.]+),\s*'([^']+)'\)|\{\s*file:\s*'([^']+)',\s*height:\s*([\d.]+)(?:[^}]*?label:\s*'([^']+)')?)/gm;
const rows = [];
let m;
while ((m = re.exec(src))) {
  const id = m[1];
  const file = m[2] ?? m[5];
  const height = m[3] ?? m[6];
  const label = m[4] ?? m[7] ?? '';
  if (!file) continue;
  rows.push({ id, file, height, label, present: existsSync(new URL(`../public/models/${file}`, import.meta.url)) });
}
const missing = rows.filter((r) => !r.present);
console.log(`${rows.length} registered models, ${rows.length - missing.length} present, ${missing.length} still to generate on Meshy:\n`);
for (const r of missing) console.log(`- ${r.id.padEnd(18)} ${r.file.padEnd(24)} ${String(r.height).padStart(5)} m  ${r.label}`);
