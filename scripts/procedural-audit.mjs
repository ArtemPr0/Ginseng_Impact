#!/usr/bin/env node
/**
 * Fails when procedural mesh geometry sneaks back into the world or character code. Only the allow-listed
 * files may construct Three.js geometry: terrain, water, grass, cloud sea, sky and VFX, the walkway slabs,
 * the placeholder marker, and Flora's InstancedMesh wrapper around loaded GLBs.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../src/', import.meta.url).pathname;
const ALLOW = new Set([
  'world/Terrain.ts', 'world/Water.ts', 'world/Grass.ts', 'world/CloudSea.ts', 'world/Walkways.ts', 'world/ModelLandmark.ts', 'world/Falls.ts', 'world/Stream.ts', 'world/Fire.ts',
  'models/Placeholder.ts', 'models/ModelRig.ts', 'combat/Vfx.ts', 'combat/Loot.ts', 'combat/CombatSystem.ts',
  'characters/Rig.ts', // the weapon-trail ribbon only; the humanoid body comes from a GLB
]);
const ALLOW_PREFIX = ['render/'];
const PATTERNS = [/\bnew\s+[A-Z]\w*Geometry\s*\(/, /\bnew\s+Mesh\s*\(/, /\bmergeGeometries\b/, /\brockify\b|\btintRock\b/];
const INSTANCED_ONLY = new Set(['world/Flora.ts']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const offenders = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (ALLOW.has(rel) || ALLOW_PREFIX.some((p) => rel.startsWith(p))) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
    const patterns = INSTANCED_ONLY.has(rel) ? [/\bnew\s+[A-Z]\w*Geometry\s*\(/, /\bnew\s+Mesh\s*\(/] : PATTERNS;
    for (const re of patterns) if (re.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
  });
}
if (offenders.length) {
  console.error('Procedural geometry outside the allow-list (everything else must be a Meshy model):');
  for (const o of offenders) console.error('  ' + o);
  process.exit(1);
}
console.log('procedural audit: clean');
