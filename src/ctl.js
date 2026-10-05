// Thin wrapper over the fxa-sandbox-ctl CLI. Slack text never reaches a shell:
// it goes into a file, and every call uses execFile with an argv array.
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const CTL = process.env.FXA_CTL || `${process.env.HOME}/Desktop/working2/fxa-sandbox-ctl/fxa-sandbox-ctl`;

function run(args, { timeout = 15 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(CTL, ['--backend', 'gce', ...args], { timeout, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stdout, stderr }));
      else resolve(stdout);
    });
  });
}

// Slack text goes to the ctl in a file, never an argument, and the file is
// deleted once the ctl has read it: it can hold other people's messages.
async function withFile(text, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'fxa-agent-'));
  const file = join(dir, 'message.md');
  try {
    await writeFile(file, text, { mode: 0o600 });
    return await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// MCP_CONNECTORS: the read-only MCP connectors for every Slack session. Unset or empty: none.
const MCP = process.env.MCP_CONNECTORS;

// findings: what a quick answer found before it asked for a sandbox. It goes in a
// second file, deleted with the first; an empty one means none.
export const task = ({ key, owner, prompt, resumeFrom, fresh, thread, isNew, runtime, link, who, queuedS, findings }) => withFile(prompt, (f) =>
  withFile(findings ?? '', (ff) => run(['task', '--source', 'slack', '--id', key, '--owner', owner, '--prompt-file', f,
    ...(thread ? ['--thread', thread, ...(isNew ? ['--new'] : [])] : []),
    ...(resumeFrom ? ['--resume-from', resumeFrom, ...(fresh ? ['--fresh'] : [])] : []), ...(runtime ? ['--runtime', runtime] : []),
    ...(link ? ['--link', link] : []), ...(queuedS ? ['--queued-s', String(queuedS)] : []), ...(findings ? ['--findings-file', ff] : []),
    ...(MCP !== undefined ? ['--mcp', MCP.replace(/\s+/g, '')] : []),
    ...(who?.name ? ['--owner-name', who.name] : []), ...(who?.image ? ['--owner-image', who.image] : [])])));

// A quick, read-only answer: {id, answer, upgrade, secs, cost_usd, turns, error}.
// Rejects when the answer runner is busy (exit 3) or down; the caller starts a session then.
export const ask = ({ id, prompt, thread }) => withFile(prompt, async (f) =>
  JSON.parse(await run(['answer', 'ask', '--id', id, '--prompt-file', f, ...(thread ? ['--thread', thread] : []), ...(MCP ? ['--mcp', MCP.replace(/\s+/g, '')] : [])], { timeout: 6 * 60_000 })));

// The same answer, streamed: onStep(text) for each tool the agent uses, as it
// uses it; resolves with the answer, rejects with the exit code (3: busy).
export const askStream = ({ id, prompt, thread, onStep }) => withFile(prompt, (f) => new Promise((resolve, reject) => {
  const c = spawn(CTL, ['--backend', 'gce', 'answer', 'ask', '--id', id, '--prompt-file', f, '--stream', ...(thread ? ['--thread', thread] : []),
    ...(MCP ? ['--mcp', MCP.replace(/\s+/g, '')] : [])], { stdio: ['ignore', 'pipe', 'pipe'] });
  let buf = '', err = '', answer = null;
  const timer = setTimeout(() => c.kill('SIGTERM'), 6 * 60_000);
  c.stdout.on('data', (d) => {
    buf += d;
    for (let i; (i = buf.indexOf('\n')) >= 0; buf = buf.slice(i + 1)) {
      try { const m = JSON.parse(buf.slice(0, i)); if (m.type === 'step') onStep?.(m.text); else if (m.type === 'answer') answer = m; } catch {}
    }
  });
  c.stderr.on('data', (d) => { err += d; });
  c.on('close', (code) => {
    clearTimeout(timer);
    if (code === 0 && answer) resolve(answer);
    else reject(Object.assign(new Error(`answer ask exited ${code}`), { code, stderr: err }));
  });
}));

export const steer = (key, message, who) => withFile(message, (f) => run(['steer', key, '--message-file', f,
  ...(who?.name ? ['--from-name', who.name] : []), ...(who?.image ? ['--from-image', who.image] : [])]));

// Returns { cursor, state, events: [{ type, text, ... }] }.
export async function events(key, since) {
  const out = await run(['events', key, '--since', String(since ?? 0)], { timeout: 60_000 });
  return JSON.parse(out);
}

export const diff = (key) => run(['diff', key], { timeout: 60_000 });
// Copies the agent's screenshots and videos off the runner; returns local paths.
// The caller deletes the returned dir once it has uploaded what it needs.
export async function media(key) {
  const dir = await mkdtemp(join(tmpdir(), 'fxa-agent-media-'));
  const out = await run(['media', key, dir], { timeout: 120_000 }).catch(async (e) => { await rm(dir, { recursive: true, force: true }); throw e; });
  return { dir, files: out.split('\n').filter(Boolean) };
}
export const cleanup = (dir) => rm(dir, { recursive: true, force: true });
// Starts the wrap-up in the background; events reports the PR or the failure.
export const finish = (key, noPr = false) => run(['finish', '--session', key, ...(noPr ? ['--no-pr'] : [])], { timeout: 60_000 });
export const stop = (key) => run(['stop', key]);
export const cost = async (key) => { try { return JSON.parse((await run(['session', 'cost', key], { timeout: 60_000 })).trim() || 'null'); } catch { return null; } };
export const pause = (key) => run(['session', 'pause', key], { timeout: 5 * 60_000 });
export const plan = async (key) => { try { return JSON.parse((await run(['session', 'plan', key], { timeout: 60_000 })).trim() || 'null'); } catch { return null; } };
export const history = async (key) => { try { return JSON.parse((await run(['session', 'history', key], { timeout: 30_000 })).trim() || '[]'); } catch { return []; } };
export const errorsList = async () => { try { return JSON.parse((await run(['errors', '--json'], { timeout: 60_000 })).trim() || '[]'); } catch { return null; } };
export const attach = (key, paths) => run(['session', 'attach', key, ...paths], { timeout: 5 * 60_000 });
export const errorsPush = () => run(['errors', 'push', '--now'], { timeout: 120_000 });
export const copilotComments = async (key) => { try { return JSON.parse((await run(['session', 'copilot-comments', key], { timeout: 60_000 })).trim() || '[]'); } catch { return []; } };
export const reviewComments = async (key, login) => { try { return JSON.parse((await run(['session', 'review-comments', key, login], { timeout: 60_000 })).trim() || '[]'); } catch { return []; } };
export const prReady = (key) => run(['session', 'pr-ready', key], { timeout: 60_000 });
// The STE lint the handoff check runs, on a reply's text: its problem lines, [] on any failure.
const STE = join(dirname(CTL), 'skills/fxa-vm-handoff/ste.sh');
export const ste = (text) => new Promise((resolve) => {
  const c = spawn('bash', [STE], { stdio: ['pipe', 'pipe', 'ignore'] });
  let out = '';
  c.stdout.on('data', (d) => { out += d; });
  c.on('error', () => resolve([]));
  c.on('close', () => resolve(out.split('\n').filter((l) => l.startsWith('ste: '))));
  c.stdin.on('error', () => {});
  c.stdin.end(String(text ?? ''));
});
export const prStatus = async (key) => { try { return JSON.parse((await run(['session', 'pr-status', key], { timeout: 60_000 })).trim() || 'null'); } catch { return null; } };
// The desktop's gateway link when the ctl has one (FXA_DESKTOP_GATEWAY), else null.
export const desktop = async (key, email) => {
  const out = await run(['session', 'desktop', key, ...(email ? [email] : [])], { timeout: 300_000 });
  return out.match(/^url=(https:\/\/\S+)$/m)?.[1] ?? null;
};
export const summary = async (key) => { try { return JSON.parse((await run(['session', 'summary', key])).trim() || 'null'); } catch { return null; } };
export const interrupt = (key) => run(['interrupt', key], { timeout: 60_000 });
// Pauses sessions idle past the ctl's threshold; returns the keys it paused.
// The keys the controller deleted under its retention rule (session prune).
export const prune = async () => (await run(['session', 'prune'], { timeout: 10 * 60_000 })).split('\n').filter((k) => /^agent-[a-z0-9]+$/.test(k));
// { paused: keys the sweep paused now, stopped: keys paused for a day that it closed }.
export const idleSweep = async () => {
  const lines = (await run(['session', 'idle-sweep'], { timeout: 10 * 60_000 })).split('\n');
  const keys = (word) => lines.filter((l) => l.startsWith(`${word} `)).map((l) => l.slice(word.length + 1).trim());
  return { paused: keys('paused'), stopped: keys('stopped') };
};

// Stream the running turn's steps. Its own process group, so stop() also ends
// the ssh under it.
export function watch(key, onEvent) {
  const child = spawn(CTL, ['--backend', 'gce', 'watch', key], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
  // Without a listener a failed spawn throws and takes the bot down.
  child.on('error', (e) => console.error('watch', key, e.message));
  let buf = '';
  child.stdout.setEncoding('utf8'); // a character split across chunks stays whole
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      try { onEvent(JSON.parse(line)); } catch { /* partial or non-JSON line */ }
    }
  });
  return { child, stop: () => { try { if (child.pid) process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ } } };
}
