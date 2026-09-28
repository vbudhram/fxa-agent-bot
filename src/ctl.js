// Thin wrapper over the fxa-sandbox-ctl CLI. Slack text never reaches a shell:
// it goes into a file, and every call uses execFile with an argv array.
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  const dir = await mkdtemp(join(tmpdir(), 'agent-tag-'));
  const file = join(dir, 'message.md');
  try {
    await writeFile(file, text, { mode: 0o600 });
    return await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export const task = ({ key, owner, prompt, resumeFrom, runtime, link, who }) => withFile(prompt, (f) =>
  run(['task', '--source', 'slack', '--id', key, '--owner', owner, '--prompt-file', f,
    ...(resumeFrom ? ['--resume-from', resumeFrom] : []), ...(runtime ? ['--runtime', runtime] : []),
    ...(link ? ['--link', link] : []),
    ...(who?.name ? ['--owner-name', who.name] : []), ...(who?.image ? ['--owner-image', who.image] : [])]));

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
  const dir = await mkdtemp(join(tmpdir(), 'agent-tag-media-'));
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
export const prStatus = async (key) => { try { return JSON.parse((await run(['session', 'pr-status', key], { timeout: 60_000 })).trim() || 'null'); } catch { return null; } };
export const summary = async (key) => { try { return JSON.parse((await run(['session', 'summary', key])).trim() || 'null'); } catch { return null; } };
export const interrupt = (key) => run(['interrupt', key], { timeout: 60_000 });
// Pauses sessions idle past the ctl's threshold; returns the keys it paused.
export const idleSweep = async () => (await run(['session', 'idle-sweep'], { timeout: 10 * 60_000 }))
  .split('\n').filter((l) => l.startsWith('paused ')).map((l) => l.slice(7).trim());

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
