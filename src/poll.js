// How often to poll a session. One waiting for its person changes only when
// they reply, and the bot starts that turn itself, so it polls slowly.
export const IDLE_MS = 60_000;

// pollEvery(session, now, lastWorkAt): 5 s while it boots, wraps up, runs a turn,
// or did work in the last minute (a turn end can start a queued message); else IDLE_MS.
export function pollEvery(s, now, lastWorkAt) {
  const working = s.state !== 'active' || Boolean(s.status_ts) || now - lastWorkAt < IDLE_MS;
  return working ? 5_000 : IDLE_MS;
}
