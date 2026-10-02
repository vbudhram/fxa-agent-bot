// Every bot error also goes to the host's error log (fxa-sandbox-ctl errors), so
// it outlives a restart and groups with the controller's errors. The format and
// the signature match lib/errors.sh in fxa-sandbox-ctl.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { ingest } from './db.js';

const FILE = process.env.FXA_ERRORS_FILE || `${process.env.HOME}/.claude/state/fxa-ai-fixme/errors.jsonl`;
const KEY = /agent-[a-z0-9]{4,12}/;

export function signature(where, message) {
  const w = String(where).replace(/:[0-9]+/g, '');
  const m = String(message)
    .replace(/agent-[a-z0-9]{4,12}/g, '<key>').replace(/[Ff][Xx][Aa]-[0-9]+/g, '<ticket>')
    .replace(/(\/[^ :]+)+/g, '<path>').replace(/[0-9a-f]{7,40}/g, '<hex>').replace(/[0-9]+/g, 'N').slice(0, 200);
  return createHash('sha1').update(`${w}|${m}`).digest('hex').slice(0, 10);
}

// The console.error calls read `where, key?, detail...`; turn one into a record.
export function toRecord(args, now = new Date()) {
  const parts = args.map((a) => (typeof a === 'string' ? a : a?.stderr || a?.data?.error || a?.message || JSON.stringify(a)));
  let [where = 'bot', ...rest] = parts;
  let key = rest.find((a) => KEY.test(a) && a.match(KEY)[0] === a) ?? null;
  if (!key && KEY.test(where) && where.match(KEY)[0] === where) { key = where; where = 'bot action'; }
  const message = rest.filter((a) => a !== key).join(' ').trim().slice(0, 600) || where;
  return { at: now.toISOString().replace(/\.\d+Z$/, 'Z'), source: 'bot', kind: String(where).split(/[ (:]/)[0],
    key, where: String(where).slice(0, 120), message, log: null, sig: signature(where, message) };
}

export function installErrorLog(push) {
  const orig = console.error.bind(console);
  let timer = null;
  try { mkdirSync(dirname(FILE), { recursive: true }); } catch {}
  console.error = (...args) => {
    orig(...args);
    const rec = toRecord(args);
    try { appendFileSync(FILE, `${JSON.stringify(rec)}\n`); } catch {}
    ingest('errors', rec);   // the store; the file stays while the store proves itself
    // At most one copy to GCS a minute, whatever the burst.
    if (push && !timer) timer = setTimeout(() => { timer = null; push().catch(() => {}); }, 60_000);
  };
}
