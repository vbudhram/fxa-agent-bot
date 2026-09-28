// Maps a Slack thread to a ctl session key. ctl owns the session record; this
// file only remembers where to post, so the bot can restart without losing threads.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const FILE = process.env.FXA_AGENT_STATE || `${process.env.HOME}/.fxa-agent-sessions.json`;

let sessions = {};
try { sessions = JSON.parse(readFileSync(FILE, 'utf8')); } catch { /* first run */ }

function save() {
  // Prompts carry other people's thread text: keep the file private.
  writeFileSync(`${FILE}.tmp`, JSON.stringify(sessions, null, 2), { mode: 0o600 });
  renameSync(`${FILE}.tmp`, FILE);
}

export const threadId = (channel, ts) => `${channel}:${ts}`;
export const get = (channel, ts) => sessions[threadId(channel, ts)];
export const all = () => Object.values(sessions);

export function put(s) {
  // A write for a session that has left the map (its thread now holds another
  // key) would otherwise land under "undefined:undefined".
  if (!s?.key || !s.channel || !s.thread_ts) return s;
  sessions[threadId(s.channel, s.thread_ts)] = s;
  save();
  return s;
}

// Merge fields into the session with this key as it is now. Writers await
// Slack between reading and writing; putting back the record they read would
// undo what others wrote meanwhile (a cursor, a stop, a mute). No-op when the
// key has left the map.
export function patch(key, fields) {
  const cur = Object.values(sessions).find((x) => x.key === key);
  return cur ? put({ ...cur, ...fields }) : undefined;
}

export function newKey() {
  return `agent-${randomBytes(3).toString('hex')}`;
}
