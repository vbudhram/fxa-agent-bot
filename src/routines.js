// Routines (epic i168): the bot's tick is the only clock routines have (D4). It runs only when ROUTINES_ENV
// is live or dev, and each bot ticks only its own env (D5).
export const ROUTINES_ENV = /^(live|dev)$/.test(process.env.ROUTINES_ENV ?? '') ? process.env.ROUTINES_ENV : null;
export const TICK_MS = Number(process.env.ROUTINES_TICK_MS) || 60_000;

const RULE = 'a team with a private repo, and every security review, posts only to a private channel that is not shared with another workspace';
// Why the run may not post in its channel, or null (D8). Fail closed: a lookup that fails refuses, and the bot
// cannot read a public channel (groups:read only), so a public channel refuses too.
export async function channelRefusal(client, run) {
  if (!run.private && run.template !== 'security-review') return null;
  const c = await client.conversations.info({ channel: run.channel }).then((r) => r.channel ?? null, () => null);
  if (!c) return `I cannot read channel ${run.channel}, and ${RULE}`;
  if (!c.is_private) return `channel ${run.channel} is public, and ${RULE}`;
  if (c.is_ext_shared || c.is_shared) return `channel ${run.channel} is shared, and ${RULE}`;
  return null;
}

// A call while the last one still runs does nothing, so a slow tick never overlaps the next.
export function inFlightGuard(fn) {
  let running = false;
  return async () => {
    if (running) return false;
    running = true;
    try { await fn(); return true; } finally { running = false; }
  };
}
