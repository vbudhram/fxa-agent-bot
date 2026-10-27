// CHANNEL_GATES=CPUBLIC:CPRIVATE: in CPUBLIC, only members of CPRIVATE may use the bot.
export const parseGates = (v) => new Map((v || '').split(',').map((p) => p.trim().split(':')).filter((p) => p.length === 2 && p[0] && p[1]));

// Fails closed: a gate whose member list never loaded lets nobody in.
export const gateAllows = (gates, members, channel, user) => !gates.has(channel) || Boolean(members.get(gates.get(channel))?.has(user));
// Who a plain reply in a live session steers: a person the channel still allows, the owner included,
// so leaving a gate's channel or the user list stops the owner's steers as it stops their commands.
// A team admin counts as the owner.
export const maySteer = (owner, user, allowedHere, steerAnyone, team, admin = false) => allowedHere && (user === owner || admin || (steerAnyone && team));
// The PR buttons go as far as steering does; the desktop, the diff and Stop stay the owner's and the admins'.
export const SHIP_ACTIONS = ['open_pr', 'push_branch', 'create_jira', 'pr_ready', 'fix_review', 'rebase_pr', 'auto_round'];
// Open PR and Push also need the team's PR list (prOk: mayOpenPr).
export const PR_ACTIONS = ['open_pr', 'push_branch'];
export const mayTap = (action, owner, user, allowedHere, steerAnyone, team, admin = false, prOk = true) =>
  PR_ACTIONS.includes(action) && !prOk ? false
    : SHIP_ACTIONS.includes(action) ? maySteer(owner, user, allowedHere, steerAnyone, team, admin) : allowedHere && (user === owner || admin);

// Reads each source channel's members. A failed read keeps the last list.
export async function loadMembers(client, gates, members) {
  for (const source of new Set(gates.values())) {
    try {
      const ids = [];
      let cursor;
      do {
        const r = await client.conversations.members({ channel: source, limit: 1000, cursor });
        ids.push(...(r.members ?? []));
        cursor = r.response_metadata?.next_cursor;
      } while (cursor);
      members.set(source, new Set(ids));
    } catch (e) {
      console.error(`channel gate: could not read the members of ${source}: ${e.data?.error ?? e.message}`);
    }
  }
}

// A team with a private repo posts code and files only in a private channel. The bot reads only
// private channels (groups:read), so a public channel's lookup fails, and that counts as public.
export const PRIVATE_ONLY = 'This team has a private repo, so I post its code and files only in a private channel.';
export const START_PRIVATE = 'This team has a private repo, so its sessions run only in a private channel. Start it there.';
export const NO_GROUPS_READ = 'I cannot tell whether this channel is private, because the Slack app lacks the groups:read scope. The operator must update the app from manifest.yml and reinstall it.';
let scopeLogged = false;
// True when a channel lookup failed because the app lacks groups:read (logged once): a private channel's lookup
// then fails like a public one's, so a refusal must name the scope, not the channel.
export function lacksGroupsRead(e) {
  const has = e?.data?.provided;
  if (e?.data?.error !== 'missing_scope' || (has ? has.split(',').includes('groups:read') : !String(e.data?.needed ?? '').includes('groups:read'))) return false;
  if (!scopeLogged) { scopeLogged = true; console.error(`channel check: missing_scope: needs groups:read (has ${has || 'unknown'}). Update the app from manifest.yml at api.slack.com/apps, then reinstall it.`); }
  return true;
}
// Why a private team's code may not go to this channel (text, or the missing scope), or null when it may.
export async function codeRefusal(s, client, text = PRIVATE_ONLY) {
  if (!s.private) return null;
  try {
    return (await client.conversations.info({ channel: s.channel })).channel?.is_private ? null : text;
  } catch (e) {
    return lacksGroupsRead(e) ? NO_GROUPS_READ : text;
  }
}
export const codeAllowed = async (s, client) => !(await codeRefusal(s, client));

// The team a session (or a pending start) belongs to. A pending resume or move has no profile of its
// own yet, so its team is the earlier session's: falling back to FxA there let anyone in.
export function sessionTeam(s, lookup) {
  for (let cur = s, n = 0; cur && n < 5; n++) {
    const p = cur.profile ?? cur.resumed_profile;
    if (p) return p;
    const from = cur.resume_from ?? cur.moved_from;
    if (!from) break;
    cur = lookup(from);
  }
  return 'fxa';
}
