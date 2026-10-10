// Posts every card from src/cards.js, with made-up sample data, to the dev test channel:
// one root message, each card a reply in its thread. A card Slack rejects goes again with
// its fallback blocks. Results: e2e/out/card-probe.json. Run: node e2e/tools/card-probe.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { SAMPLES, SAMPLE_ENV } from './card-samples.mjs';

const root = new URL('../../', import.meta.url);
const env = Object.fromEntries(readFileSync(new URL('.env.dev', root), 'utf8').split('\n')
  .map((l) => l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(([, k, v]) => [k, v.replace(/^(['"])(.*)\1$/, '$2')]));
const token = env.SLACK_BOT_TOKEN, channel = (env.ALLOWED_CHANNELS ?? '').split(',')[0].trim();
if (!token || !channel) throw new Error('.env.dev needs SLACK_BOT_TOKEN and ALLOWED_CHANNELS');
Object.assign(process.env, SAMPLE_ENV); // the example.com links pass the allowlist
const { BUILDERS } = await import('../../src/cards.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(body) {
  for (;;) {
    const r = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel, ...body }) });
    const j = await r.json();
    if (j.error === 'ratelimited') { await sleep(1000 * Number(r.headers.get('retry-after') ?? 3)); continue; }
    await sleep(1200);
    return j;
  }
}
const why = (j) => [j.error, ...(j.response_metadata?.messages ?? [])].join(' ');

const head = await post({ text: `Card probe ${new Date().toISOString()}` });
if (!head.ok) throw new Error(`root post failed: ${head.error}`);
const thread_ts = head.ts, results = [];
for (const [kind, data] of Object.entries(SAMPLES)) {
  const c = BUILDERS[kind](data);
  const a = await post({ thread_ts, text: c.text, blocks: c.blocks });
  const row = { kind, result: a.ok ? 'accepted' : 'error', ts: a.ts ?? null, error: a.ok ? null : why(a) };
  if (!a.ok) {
    console.log(`${kind}: rejected (${row.error})${c.fallback ? ', sending the fallback' : ''}`);
    if (c.fallback) {
      const b = await post({ thread_ts, text: c.text, blocks: c.fallback });
      Object.assign(row, b.ok ? { result: 'fallback', ts: b.ts } : { fallback_error: why(b) });
    }
  }
  results.push(row);
  console.log(`${kind}: ${row.result}${row.ts ? ` ${row.ts}` : ''}`);
}
mkdirSync(new URL('e2e/out/', root), { recursive: true });
writeFileSync(new URL('e2e/out/card-probe.json', root), `${JSON.stringify({ channel, thread_ts, at: new Date().toISOString(), results }, null, 1)}\n`);
console.log(`thread ${thread_ts}`);
