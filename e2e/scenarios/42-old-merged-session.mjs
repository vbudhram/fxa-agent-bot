// A pr_open session whose merge the bot saw before end cards existed: no late end card, no stop.
const old = Math.floor(Date.now() / 1000) - 5 * 86_400;
export default {
  title: 'An old merged pr_open session gets no late end card and no stop',
  people: { A: 'owner, allowed' },
  sessions: { [`C_TEST:${old}.000100`]: { key: 'agent-old1', channel: 'C_TEST', thread_ts: `${old}.000100`, user: 'UA', state: 'pr_open',
    started_at: old * 1000, pr_url: 'https://github.com/mozilla/fxa/pull/123', pr_ended: 'MERGED', pr_follow_done: true,
    pr_seen: { state: 'MERGED', number: 123 } } },
  steps: [
    { pause: 3, wait: 'none', expect: { noCtl: 'stop', postCount: { match: /Session ended/, n: 0 } } },
  ],
  judge: 'Nothing is posted in the old thread.',
};
