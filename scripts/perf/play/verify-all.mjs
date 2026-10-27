#!/usr/bin/env node
// Full headless verification: unit tests already separate; this drives every runtime sweep + audits.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const run = join(root, 'scripts/perf/run.mjs');
const base = 'http://127.0.0.1:4173';
const results = [];

function checkReady() {
  try {
    const a = spawnSync('curl', ['-sf', '-o', '/dev/null', `${base}/`], { encoding: 'utf8' });
    const b = spawnSync('curl', ['-sf', 'http://127.0.0.1:9333/json/list'], { encoding: 'utf8' });
    if (a.status !== 0 || b.status !== 0) {
      console.error('Need preview on 4173 and Chrome CDP on 9333 (see .claude/skills/verify).');
      process.exit(2);
    }
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
}

function runBody(name, at, loadS, file) {
  console.log(`\n===== ${name} @ ${at} =====`);
  const r = spawnSync('node', [run, `${base}/?at=${at}`, String(loadS), file], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.trim().split('\n');
  const body = lines.find((l) => l.startsWith('{') || l.startsWith('EXCEPTION')) || lines[0] || '';
  const cons = lines.find((l) => l.startsWith('CONSOLE:')) || 'CONSOLE: []';
  let parsed = null;
  try { parsed = JSON.parse(body); } catch { parsed = { raw: body.slice(0, 500) }; }
  const hardConsole = (() => {
    try {
      const arr = JSON.parse(cons.slice('CONSOLE: '.length));
      return arr.filter((e) => e.level === 'error');
    } catch { return []; }
  })();
  // Audits list by-design flags; they fail only on exceptions / console errors, not on flagged rows.
  const isAudit = name.startsWith('layout') || name.startsWith('glows') || name.startsWith('characters');
  const sweepOk = isAudit
    ? !String(body).startsWith('EXCEPTION') && hardConsole.length === 0
    : parsed?.ok === true || (name === 'hollowking' && parsed?.aggro === true);
  const ok = r.status === 0 && sweepOk && !String(body).startsWith('EXCEPTION') && hardConsole.length === 0;
  results.push({
    name, ok, parsed, hardConsole: hardConsole.slice(0, 10), status: r.status,
    auditFlags: isAudit ? (parsed?.flagged?.length ?? parsed?.n ?? null) : undefined,
  });
  console.log(JSON.stringify(parsed, null, 0).slice(0, 1200));
  if (hardConsole.length) console.log('ERRORS:', JSON.stringify(hardConsole.slice(0, 5)));
  return ok;
}

checkReady();

const play = join(root, 'scripts/perf/play');
const audit = join(root, 'scripts/perf/audit');

let allOk = true;
allOk = runBody('dialogue', '0,40', 10, join(play, 'sweep-dialogue.js')) && allOk;
allOk = runBody('quests', '0,40', 10, join(play, 'sweep-quests.js')) && allOk;
allOk = runBody('enemies', '0,40', 10, join(play, 'sweep-enemies.js')) && allOk;
allOk = runBody('interact', '0,40', 10, join(play, 'sweep-interact.js')) && allOk;
allOk = runBody('hollowking', '36,-146', 8, join(play, 'hollowking.js')) && allOk;
allOk = runBody('layout', '0,40', 8, join(audit, 'layout.js')) && allOk;
allOk = runBody('glows', '0,40', 8, join(audit, 'glows.js')) && allOk;
allOk = runBody('characters@island', '0,40', 8, join(audit, 'characters.js')) && allOk;
allOk = runBody('characters@snow', '931,124', 8, join(audit, 'characters.js')) && allOk;

// Ending shortcut.
console.log('\n===== ending =====');
{
  const r = spawnSync('node', [join(play, 'playthrough.mjs')], { cwd: root, encoding: 'utf8' });
  const parsed = (() => { try { return JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch { return { raw: r.stdout }; } })();
  const ok = r.status === 0 && parsed?.ok;
  results.push({ name: 'ending', ok, parsed, status: r.status });
  console.log(JSON.stringify(parsed));
  allOk = ok && allOk;
}

const summary = {
  ok: allOk,
  passed: results.filter((r) => r.ok).map((r) => r.name),
  failed: results.filter((r) => !r.ok).map((r) => ({
    name: r.name,
    failCount: r.parsed?.failCount,
    failures: r.parsed?.failures?.slice?.(0, 8) ?? r.parsed,
    console: r.hardConsole,
  })),
};
console.log('\n===== SUMMARY =====');
console.log(JSON.stringify(summary, null, 2));
process.exit(allOk ? 0 : 1);
