// The quick looks in flight: they run inside the bot process, so a restart cut them off with no record to
// resume from, and their card stayed at "Working on it". Only where to post is kept, never the request.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';

const file = () => `${process.env.FXA_AGENT_STATE || `${process.env.HOME}/.fxa-agent-sessions.json`}.quick.json`;
const read = () => { try { return JSON.parse(readFileSync(file(), 'utf8')); } catch { return {}; } };
const write = (o) => { writeFileSync(`${file()}.tmp`, JSON.stringify(o), { mode: 0o600 }); renameSync(`${file()}.tmp`, file()); };

export function mark(key, rec) { const o = read(); o[key] = { ...o[key], ...rec }; write(o); }
export function clear(key) { const o = read(); if (key in o) { delete o[key]; write(o); } }
// The looks a restart cut off, each returned once: a second restart posts nothing more.
export function takeLeft() { const o = read(); if (Object.keys(o).length) write({}); return Object.values(o); }
