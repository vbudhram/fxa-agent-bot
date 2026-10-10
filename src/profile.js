// Which team profile a new session runs with. The first rule that matches wins:
// a profile:<name> flag, a Jira key by prefix (PROFILE_JIRA=MNTOR:monitor), the
// channel (PROFILE_CHANNELS=C123:monitor), else the controller's default (FxA).
// Any profile but fxa is only for the people PROFILE_USERS lists (monitor:U1+U2), or for
// everyone allowed when PROFILE_OPEN names it.
const pairs = (v) => new Map((v || '').split(',').map((p) => p.trim().split(':')).filter((p) => p.length === 2 && p[0] && p[1]));

export function resolveProfile({ text, channel, user, env = process.env }) {
  let profile;
  // Only as the first word: a pasted log or scope list ("openid profile:email") is not a flag.
  const flag = text.trim().match(/^profile:(\S+)/i);
  if (flag) {
    profile = flag[1].toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(profile)) return { error: `"${flag[1]}" is not a profile name.` };
    text = text.trim().slice(flag[0].length).trim();
  } else {
    const jira = pairs(env.PROFILE_JIRA);
    const key = [...text.matchAll(/\b([A-Z][A-Z0-9]+)-\d+\b/g)].find((m) => jira.has(m[1]));
    profile = key ? jira.get(key[1]) : pairs(env.PROFILE_CHANNELS).get(channel);
  }
  // PROFILE_OPEN=pyfxa-team: a team anyone allowed here may use.
  const open = (env.PROFILE_OPEN || '').split(',').map((x) => x.trim()).includes(profile);
  if (profile && profile !== 'fxa' && !open) {
    const users = (pairs(env.PROFILE_USERS).get(profile) || '').split('+');
    if (!users.includes(user)) return { error: `You can't start a ${profile} session yet.` };
  }
  return { profile, text };
}
