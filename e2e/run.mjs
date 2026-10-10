// npm run e2e [-- name-filter]: run each scenario against the real bot, fake Slack and fake-ctl.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BOT = resolve(HERE, '..');
const CTL = process.env.FXA_CTL_REPO || resolve(BOT, '../fxa-sandbox-ctl');
const PARALLEL = 8;
const filter = process.argv[2] ?? '';

// A scenario's matrix: {order: [...], STEER: [...]} gives one run per combination.
function variants(sc) {
  let vs = [{}];
  for (const [k, vals] of Object.entries(sc.matrix ?? {})) vs = vs.flatMap((v) => vals.map((x) => ({ ...v, [k]: x })));
  return vs;
}

function runOne({ file, sc, vary }) {
  const tag = Object.entries(vary).map(([k, v]) => `${k}=${v}`).join(',');
  const name = `${file.replace(/\.mjs$/, '')}${tag ? `@${tag}` : ''}`;
  const out = join(HERE, 'out', name);
  rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
  const home = mkdtempSync(join(tmpdir(), 'fxa-e2e-'));
  writeFileSync(join(home, 'now'), String(Math.floor(Date.now() / 1000)));
  return new Promise((done) => {
    const people = Object.entries(sc.people);
    // Only what the bot needs: no .env, and every state path in a fresh HOME.
    const env = {
      PATH: process.env.PATH, HOME: home, TMPDIR: home, LANG: 'C.UTF-8',
      SLACK_BOT_TOKEN: 'xoxb-fake', SLACK_APP_TOKEN: 'xapp-fake',
      FXA_CTL: join(CTL, 'skills/fxa-ctl-dev/fake-ctl.sh'), FAKE_CTL_DIR: join(home, 'ctl'), FAKE_NOW_FILE: join(home, 'now'),
      FAKE_CTL_LOG: join(out, 'ctl.jsonl'), FAKE_TICK: '0.2', FAKE_PROFILES: join(HERE, 'profiles.json'), PROFILE_OPEN: 'pyfxa-team',
      FXA_AGENT_STATE: join(home, 'sessions.json'), FXA_ERRORS_FILE: join(home, 'errors.jsonl'), FXA_DB: '/nonexistent/fxa.db',
      ERROR_DMS: '0', QUICK_ANSWERS: '0', ALLOWED_CHANNELS: 'C_TEST',
      ALLOWED_USERS: people.filter(([, d]) => !/not allowed/.test(d)).map(([p]) => `U${p}`).join(','),
      E2E_SCENARIO: join(HERE, 'scenarios', file), E2E_OUT: out, ...(sc.env ?? {}),
      ...Object.fromEntries(Object.entries(vary).map(([k, v]) => [k === 'order' ? 'E2E_ORDER' : k, v])),
    };
    const t0 = Date.now();
    const child = spawn(process.execPath, ['--import', join(HERE, 'preload.mjs'), 'src/app.js'], { cwd: BOT, env, stdio: ['ignore', 'inherit', 'inherit'] });
    const kill = setTimeout(() => child.kill('SIGTERM'), 120_000);
    child.on('exit', (code) => {
      clearTimeout(kill);
      rmSync(home, { recursive: true, force: true });
      let r = { ok: false, failures: [`exit ${code}`] };
      try { r = JSON.parse(readFileSync(join(out, 'result.json'), 'utf8')); } catch {}
      done({ name, title: sc.title, s: ((Date.now() - t0) / 1000).toFixed(1), ...r });
    });
  });
}

const files = readdirSync(join(HERE, 'scenarios')).filter((f) => f.endsWith('.mjs') && f.includes(filter)).sort();
const jobs = [];
for (const file of files) { const sc = (await import(join(HERE, 'scenarios', file))).default; for (const vary of variants(sc)) jobs.push({ file, sc, vary }); }
// A pool of PARALLEL runs at a time.
const results = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(PARALLEL, jobs.length) }, async () => { while (next < jobs.length) results.push(await runOne(jobs[next++])); }));
results.sort((a, b) => a.name.localeCompare(b.name));
for (const r of results) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name} (${r.s}s) ${r.title}`);
  for (const f of r.failures ?? []) console.log(`       ✗ ${f}`);
  for (const f of r.xfail ?? []) console.log(`       ~ known: ${f}`);
  for (const f of r.fixed ?? []) console.log(`       ! ${f}`);
  if (!r.ok) console.log(`       see e2e/out/${r.name}/thread.txt`);
}
const bad = results.filter((r) => !r.ok).length;
console.log(`${results.length - bad}/${results.length} pass, ${results.reduce((n, r) => n + (r.xfail?.length ?? 0), 0)} known failures`);
process.exit(bad ? 1 : 0);
