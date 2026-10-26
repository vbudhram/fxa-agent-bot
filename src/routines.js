// Routines (epic i168): the bot's tick is the only clock routines have (D4). It runs only when ROUTINES_ENV
// is live or dev, and each bot ticks only its own env (D5).
export const ROUTINES_ENV = /^(live|dev)$/.test(process.env.ROUTINES_ENV ?? '') ? process.env.ROUTINES_ENV : null;
export const TICK_MS = Number(process.env.ROUTINES_TICK_MS) || 60_000;

// A routine with no channel posts nothing in Slack (D32): its session holds this channel, and the bot's Slack
// client answers every call to it at once, with no request.
export const NO_CHANNEL = 'history-only';
let fakeN = 0;
export const muted = (args) => args?.channel === NO_CHANNEL || args?.channel_id === NO_CHANNEL;
export const mutedReply = () => ({ ok: true, channel: NO_CHANNEL, ts: `${Math.floor(Date.now() / 1000)}.${String(++fakeN % 1e6).padStart(6, '0')}`, files: [] });

const RULE = 'a team with a private repo, and every security review, posts only to a private channel that is not shared with another workspace';
// Why the run may not post in its channel, or null (D8). Fail closed: a lookup that fails refuses, and the bot
// cannot read a public channel (groups:read only), so a public channel refuses too.
export async function channelRefusal(client, run) {
  if (!run.channel) return null;
  if (!run.private && run.template !== 'security-review') return null;
  const c = await client.conversations.info({ channel: run.channel }).then((r) => r.channel ?? null, () => null);
  if (!c) return `I cannot read channel ${run.channel}, and ${RULE}`;
  if (!c.is_private) return `channel ${run.channel} is public, and ${RULE}`;
  if (c.is_ext_shared || c.is_shared) return `channel ${run.channel} is shared, and ${RULE}`;
  return null;
}

// The channels this bot is in, for the channel picker of the dashboard's routine form. Without channels:read
// or groups:read Slack answers missing_scope for that type, so the list then holds the other type only.
export async function botChannels(client) {
  for (const types of ['public_channel,private_channel', 'private_channel', 'public_channel']) {
    const out = [];
    let cursor;
    try {
      do {
        const r = await client.users.conversations({ types, limit: 200, exclude_archived: true, cursor });
        for (const c of r.channels ?? []) out.push({ id: c.id, name: c.name, private: !!c.is_private, shared: !!(c.is_ext_shared || c.is_shared) });
        cursor = r.response_metadata?.next_cursor;
      } while (cursor);
      return out;
    } catch (e) {
      if (e.data?.error !== 'missing_scope' || types === 'public_channel') throw e;
    }
  }
}

// The people in the workspace, for the people picker of a team's Settings: no bot, no deactivated account.
export async function workspaceUsers(client) {
  const out = [];
  let cursor;
  do {
    const r = await client.users.list({ limit: 200, cursor });
    for (const u of r.members ?? []) {
      if (u.deleted || u.is_bot || u.id === 'USLACKBOT') continue;
      out.push({ id: u.id, name: u.profile?.real_name || u.real_name || u.name, handle: u.profile?.display_name || u.name || '', email: u.profile?.email || '' });
    }
    cursor = r.response_metadata?.next_cursor;
  } while (cursor);
  return out;
}

// Runs fetch at start and every `every` ms, and gives each list to write. Without the scopes Slack answers
// missing_scope every time, so that stops the polling: one error each start, not one every interval.
function pollList(label, fetch, write, every) {
  let timer = null;
  const list = () => fetch().then(write, (e) => {
    if (e.data?.error !== 'missing_scope') return console.error(label, e.data?.error || e.message);
    // The scopes come from manifest.yml, but an installed app keeps its old ones until someone reinstalls it.
    console.error(label, `missing_scope: needs ${e.data.needed || 'a scope'} (has ${e.data.provided || 'unknown'}). Update the app from manifest.yml at api.slack.com/apps, then reinstall it.`);
    clearInterval(timer);
  });
  timer = setInterval(list, every);
  timer.unref?.();
  return list();
}
export const pollChannels = (client, write, every = 600_000) => pollList('channel list', () => botChannels(client), write, every);
// People change slowly, and users.list is a page per 200 people: every 6 hours.
export const pollUsers = (client, write, every = 21_600_000) => pollList('user list', () => workspaceUsers(client), write, every);

// A call while the last one still runs does nothing, so a slow tick never overlaps the next.
export function inFlightGuard(fn) {
  let running = false;
  return async () => {
    if (running) return false;
    running = true;
    try { await fn(); return true; } finally { running = false; }
  };
}
