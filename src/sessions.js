// Maps a Slack thread to a ctl session key. ctl owns the session record; this
// file only remembers where to post, so the bot can restart without losing threads.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const FILE = process.env.AGENT_TAG_STATE || `${process.env.HOME}/.agent-tag-sessions.json`;

let sessions = {};
try { sessions = JSON.parse(readFileSync(FILE, 'utf8')); } catch { /* first run */ }

function save() {
  writeFileSync(`${FILE}.tmp`, JSON.stringify(sessions, null, 2));
  renameSync(`${FILE}.tmp`, FILE);
}

export const threadId = (channel, ts) => `${channel}:${ts}`;
export const get = (channel, ts) => sessions[threadId(channel, ts)];
export const all = () => Object.values(sessions);

export function put(s) {
  sessions[threadId(s.channel, s.thread_ts)] = s;
  save();
  return s;
}

export function newKey() {
  return `agent-${randomBytes(3).toString('hex')}`;
}
