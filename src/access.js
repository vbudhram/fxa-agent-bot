// CHANNEL_GATES=CPUBLIC:CPRIVATE: in CPUBLIC, only members of CPRIVATE may use the bot.
export const parseGates = (v) => new Map((v || '').split(',').map((p) => p.trim().split(':')).filter((p) => p.length === 2 && p[0] && p[1]));

// Fails closed: a gate whose member list never loaded lets nobody in.
export const gateAllows = (gates, members, channel, user) => !gates.has(channel) || Boolean(members.get(gates.get(channel))?.has(user));

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
export async function codeAllowed(s, client) {
  if (!s.private) return true;
  return client.conversations.info({ channel: s.channel }).then((r) => Boolean(r.channel?.is_private)).catch(() => false);
}
