// How often to poll a session. One waiting for its person changes only when
// they reply, and the bot starts that turn itself, so it polls slowly.
export const IDLE_MS = 60_000;
// The agent's media posts at a step at most once a minute; the turn's end posts the rest at once.
export const MEDIA_MID_MS = 60_000;
export const mediaDue = (lastAt, now) => lastAt === undefined || now - lastAt >= MEDIA_MID_MS;
// mediaSettled(name, mtime, sent, now): mid-turn, post a file only when no version of it has posted and it has not
// changed for a minute. A growing .log or a video being recorded waits for the turn's end.
export const mediaSettled = (name, mtime, sent, now) => now - mtime >= MEDIA_MID_MS && ![...sent].some((id) => id.startsWith(`${name}:`));

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
// One replies call per thread on each restart hit Slack's rate limit for minutes (170 threads on the dev bot), so a thread idle a day is not read.
export const REPLAY_IDLE_S = 86_400;
export const replayable = (s, now, mark = replayMark(s)) => !!mark && now - Number(mark) < REPLAY_IDLE_S;
export function missed(s, messages, now, mark = replayMark(s)) {
  if (!mark) return [];
  const floor = (now - REPLAY_S).toFixed(6), from = mark > floor ? mark : floor;
  return messages.filter((m) => m.ts !== s.thread_ts && m.ts > from && m.user
    && (!m.subtype || ['thread_broadcast', 'file_share'].includes(m.subtype)));
}
