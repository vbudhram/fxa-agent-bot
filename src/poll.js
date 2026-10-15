// How often to poll a session. One waiting for its person changes only when
// they reply, and the bot starts that turn itself, so it polls slowly.
export const IDLE_MS = 60_000;

// pollEvery(session, now, lastWorkAt): 5 s while it boots, wraps up, runs a turn,
// or did work in the last minute (a turn end can start a queued message); else IDLE_MS.
export function pollEvery(s, now, lastWorkAt) {
  const working = s.state !== 'active' || Boolean(s.status_ts) || now - lastWorkAt < IDLE_MS;
  return working ? 5_000 : IDLE_MS;
}

// A session in a channel no longer allowed (another workspace, after a token change): the bot
// cannot post there, so its loops leave it alone. Adding the channel back resumes it.
export const reachable = (s, channels) => !channels.length || channels.includes(s.channel);

// A reply sent while the bot restarted never arrives as an event. missed(s, messages, now): the
// thread's replies newer than the last one the bot handled (last_ts) and at most REPLAY_S old, so a
// long outage replays nothing stale. Slack ts strings have six decimals: string order is time order.
export const REPLAY_S = 900;
// The mark to replay from: the last reply handled, else the session's start (after the message that
// started it, so that one does not come again). A quick answer with neither replays nothing.
export const replayMark = (s) => s.last_ts ?? (s.started_at ? (s.started_at / 1000).toFixed(6) : null);
export function missed(s, messages, now, mark = replayMark(s)) {
  if (!mark) return [];
  const floor = (now - REPLAY_S).toFixed(6), from = mark > floor ? mark : floor;
  return messages.filter((m) => m.ts !== s.thread_ts && m.ts > from && m.user
    && (!m.subtype || ['thread_broadcast', 'file_share'].includes(m.subtype)));
}
