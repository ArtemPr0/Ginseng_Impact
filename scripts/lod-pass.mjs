#!/usr/bin/env node
/**
 * Performance pass over public/models (2026-10-14): triangle budgets for repeated models and texture sizes by role.
 * Re-runnable: each file is simplified toward its budget (normal simplifier, then sloppy mode when texture seams stall
 * it) and its textures resized. Files not listed keep their geometry and get 512 px textures unless they are in KEEP_1024.
 *   node scripts/lod-pass.mjs [file ...]
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

/** Triangle budgets: instanced flora/props are drawn dozens to hundreds of times. */
const BUDGET = {
  'pine.glb': 3500, 'flower.glb': 400, 'chasm-bridge.glb': 2500, 'giant-mushroom.glb': 3000, 'causeway-segment.glb': 5000,
  'village-house.glb': 12000, 'brazier.glb': 2500, 'jellyfish.glb': 2500, 'purple-crystal.glb': 2000, 'coin-block.glb': 5000,
  'checker-road.glb': 2000, 'stepping-stone.glb': 600, 'candle.glb': 500, 'torch-post.glb': 1200, 'lantern-post.glb': 1500,
  'mushroom-lamp.glb': 1500, 'hanging-lantern.glb': 2000, 'purple-mushroom.glb': 2500, 'round-tower.glb': 10000,
  'purple-house.glb': 12000, 'barrel.glb': 3000, 'flying-koi.glb': 3000, 'snake.glb': 6000, 'stone-throne.glb': 5000,
  'crystal-ball.glb': 2000, 'market-stall.glb': 10000, 'causeway-stairs.glb': 12000,
  // single but far too dense
  'marsh-demon.glb': 40000, 'lake-lurker.glb': 40000, 'cathedral.glb': 50000,
};
/** Seen big and close: heroes, bosses, landmarks. Everything else gets 512 px textures. */
const KEEP_1024 = new Set(['knight.glb', 'archer.glb', 'wizard.glb', 'cathedral.glb', 'castle.glb', 'giant-head.glb', 'wizard-tower.glb',
  'yeti.glb', 'rock-troll.glb', 'antlered-warden.glb', 'horned-shade.glb', 'lake-lurker.glb', 'marsh-demon.glb', 'hollow-king.glb',
  'frog-king.glb', 'spider-chapel.glb', 'log-giant.glb', 'demon-church.glb', 'tree-house.glb', 'world-tree.glb', 'galaxy-hall.glb']);

const only = process.argv.slice(2);
const files = (only.length ? only : readdirSync('public/models').filter((f) => f.endsWith('.glb'))).map((f) => f.replace(/^.*\//, ''));
for (const f of files) {
  const path = `public/models/${f}`;
  const tex = KEEP_1024.has(f) ? '1024' : '512';
  const tris = String(BUDGET[f] ?? 0);
  const out = execFileSync('node', ['scripts/model-tools.mjs', 'optimize', path, path, tex, tris], { encoding: 'utf8', env: { ...process.env, SIMPLIFY_ERROR: process.env.SIMPLIFY_ERROR ?? '0.02' } });
  const info = execFileSync('node', ['scripts/model-tools.mjs', 'info', path], { encoding: 'utf8' }).split('\n');
  console.log(`${f.padEnd(24)} tex ${tex.padStart(4)}  ${info[1].trim().replace('meshes 1, ', '')}  ${info[0].split(': ')[1]}${/sloppy/.test(out) ? '  (sloppy)' : ''}`);
}
