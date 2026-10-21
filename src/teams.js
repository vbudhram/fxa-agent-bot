// Team records (the controller's lib/teams.sh): the access rules of each team in the host's
// teams cache, index.json. Read again whenever the file changes, so a new or changed team needs
// no restart. A bad file keeps the last good copy; no file means no record team is open.
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ID = { name: /^[a-z][a-z0-9-]{1,30}$/, user: /^[UW][A-Z0-9]{6,}$/, channel: /^C[A-Z0-9]{6,}$/, prefix: /^[A-Z][A-Z0-9]{1,9}$/ };
const only = (v, re) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && re.test(x)) : []);
let cache = { file: '', mtime: -1, teams: {} };

export const indexFile = (env = process.env) =>
  env.FXA_TEAMS_INDEX || join(env.FXA_TEAMS_DIR || join(homedir(), '.claude', 'state', 'teams'), 'index.json');

// Keep only what the bot needs, in the shapes it checks.
function clean(index) {
  const teams = {};
  for (const [name, t] of Object.entries(index?.teams ?? {})) {
    if (!ID.name.test(name) || typeof t !== 'object' || !t) continue;
    const a = t.access ?? {};
    teams[name] = { label: typeof t.label === 'string' ? t.label : name, status: t.status === 'active' ? 'active' : String(t.status ?? 'draft'),
      open: a.open === true, users: only(a.users, ID.user), channels: only(a.channels, ID.channel),
      // A team that takes a project's secret tickets does not claim the project: its key still starts the public team's session.
      prefixes: [...only(a.jira_prefixes, ID.prefix), ...(t.secret !== true && ID.prefix.test(t.jira ?? '') ? [t.jira] : [])] };
  }
  return teams;
}

// teamIndex: { <name>: { label, status, open, users, channels, prefixes } } for every record team.
export function teamIndex(env = process.env, fs = { statSync, readFileSync }) {
  const file = indexFile(env);
  let mtime;
  try { mtime = fs.statSync(file).mtimeMs; } catch { cache = { file, mtime: -1, teams: {} }; return cache.teams; }
  if (file === cache.file && mtime === cache.mtime) return cache.teams;
  try {
    cache = { file, mtime, teams: clean(JSON.parse(fs.readFileSync(file, 'utf8'))) };
  } catch (e) {
    console.error('teams index', file, e.message);
    cache = { file, mtime, teams: file === cache.file ? cache.teams : {} };
  }
  return cache.teams;
}

// The channels that record teams bind: the bot answers there as in ALLOWED_CHANNELS.
export const teamChannels = (env = process.env) => Object.values(teamIndex(env)).filter((t) => t.status === 'active').flatMap((t) => t.channels);
