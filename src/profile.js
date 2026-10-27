// Which team profile a new session runs with. The first rule that matches wins:
// a profile:<name> flag, a Jira key by prefix (PROFILE_JIRA=MNTOR:monitor), the
// channel (PROFILE_CHANNELS=C123:monitor), else the controller's default (FxA).
// Any profile but fxa is only for the people PROFILE_USERS lists (monitor:U1+U2), or for
// everyone allowed when PROFILE_OPEN names it. A team record (teams.js) adds its own rules:
// an active record is open, or lists its users, and routes its channels and Jira prefixes.
import { teamIndex } from './teams.js';

const pairs = (v) => new Map((v || '').split(',').map((p) => p.trim().split(':')).filter((p) => p.length === 2 && p[0] && p[1]));

export function resolveProfile({ text, channel, user, env = process.env }) {
  let profile;
  // Only as the first word: a pasted log or scope list ("openid profile:email") is not a flag.
  const flag = text.trim().match(/^(?:profile|team):(\S+)/i);
  if (flag) {
    profile = flag[1].toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(profile)) return { error: `"${flag[1]}" is not a profile name.` };
    text = text.trim().slice(flag[0].length).trim();
  } else {
    const jira = pairs(env.PROFILE_JIRA), channels = pairs(env.PROFILE_CHANNELS);
    for (const [name, t] of Object.entries(teamIndex(env))) {
      for (const p of t.prefixes) if (!jira.has(p)) jira.set(p, name);
      for (const c of t.channels) if (!channels.has(c)) channels.set(c, name);
    }
    const key = [...text.matchAll(/\b([A-Z][A-Z0-9]+)-\d+\b/g)].find((m) => jira.has(m[1]));
    profile = key ? jira.get(key[1]) : channels.get(channel);
  }
  // The text too: a !stack pick in the thread can override the refusal (onMention).
  if (profile && !mayStart(profile, user, env)) return { error: `You can't start a ${profile} session yet.`, text };
  return { profile, text };
}

// A team's admins and the people who may open a PR from Slack: a record's, else PROFILE_ADMINS and
// PROFILE_PR_USERS (fxa:U1+U2), for a team with no record such as fxa.
export function teamPeople(profile, env = process.env) {
  const t = teamIndex(env)[profile];
  if (t) return { admins: t.admins, prUsers: t.prUsers };
  const ids = (v) => (pairs(v).get(profile) || '').split('+').filter((x) => /^[UW][A-Z0-9]{6,}$/.test(x));
  return { admins: ids(env.PROFILE_ADMINS), prUsers: ids(env.PROFILE_PR_USERS) };
}
// An admin can take over any control in the team's threads.
export const isAdmin = (profile, user, env = process.env) => teamPeople(profile, env).admins.includes(user);
// With no PR list, anyone who can steer opens a PR, as before; with one, its people and the admins.
export function mayOpenPr(profile, user, env = process.env) {
  const p = teamPeople(profile, env);
  return !p.prUsers.length || p.prUsers.includes(user) || p.admins.includes(user);
}

// The one gate for a team: fxa for everyone; a team record by its own status and access alone, so an
// env entry left from before the move cannot reopen a draft, disabled or gated team; a team with no
// record by PROFILE_OPEN (everyone allowed here) or PROFILE_USERS. The !stack picker (teamsFor) uses it too.
export function mayStart(profile, user, env = process.env) {
  if (profile === 'fxa') return true;
  const t = teamIndex(env)[profile];
  if (t) return t.status === 'active' && (t.open || t.users.includes(user));
  if ((env.PROFILE_OPEN || '').split(',').map((x) => x.trim()).includes(profile)) return true;
  return (pairs(env.PROFILE_USERS).get(profile) || '').split('+').includes(user);
}
