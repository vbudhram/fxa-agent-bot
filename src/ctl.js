// Thin wrapper over the fxa-sandbox-ctl CLI. Slack text never reaches a shell:
// it goes into a file, and every call uses execFile with an argv array.
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
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

async function toFile(text) {
  const dir = await mkdtemp(join(tmpdir(), 'agent-tag-'));
  const file = join(dir, 'message.md');
  await writeFile(file, text, { mode: 0o600 });
  return file;
}

export async function task({ key, owner, prompt }) {
  return run(['task', '--source', 'slack', '--id', key, '--owner', owner,
    '--prompt-file', await toFile(prompt)]);
}

export async function steer(key, message) {
  return run(['steer', key, '--message-file', await toFile(message)]);
}

// Returns { cursor, state, events: [{ type, text, ... }] }.
export async function events(key, since) {
  const out = await run(['events', key, '--since', String(since ?? 0)], { timeout: 60_000 });
  return JSON.parse(out);
}

export const diff = (key) => run(['diff', key], { timeout: 60_000 });
// Copies the agent's screenshots and videos off the runner; returns local paths.
export async function media(key) {
  const dir = await mkdtemp(join(tmpdir(), 'agent-tag-media-'));
  const out = await run(['media', key, dir], { timeout: 120_000 });
  return out.split('\n').filter(Boolean);
}
// Starts the wrap-up in the background; events reports the PR or the failure.
export const finish = (key) => run(['finish', '--session', key], { timeout: 60_000 });
export const stop = (key) => run(['stop', key]);

// Stream the running turn's steps. Its own process group, so stop() also ends
// the ssh under it.
export function watch(key, onEvent) {
  const child = spawn(CTL, ['--backend', 'gce', 'watch', key], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      try { onEvent(JSON.parse(line)); } catch { /* partial or non-JSON line */ }
    }
  });
  return { child, stop: () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ } } };
}
