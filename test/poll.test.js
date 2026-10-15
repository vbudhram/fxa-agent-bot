import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pollEvery, IDLE_MS, reachable, missed, REPLAY_S } from '../src/poll.js';

test('a session waiting for its person polls slowly; one with work polls every 5 s', () => {
  const now = 1_000_000;
  assert.equal(pollEvery({ state: 'active' }, now, 0), IDLE_MS);
  assert.equal(pollEvery({ state: 'active', status_ts: '1.2' }, now, 0), 5_000); // a turn is running
  assert.equal(pollEvery({ state: 'starting' }, now, 0), 5_000);
  assert.equal(pollEvery({ state: 'wrapping' }, now, 0), 5_000);
  assert.equal(pollEvery({ state: 'active' }, now, now - 30_000), 5_000); // work 30 s ago: a queued turn may start
  assert.equal(pollEvery({ state: 'active' }, now, now - IDLE_MS), IDLE_MS);
});

test('the loops leave alone a session in a channel no longer allowed', () => {
  assert.equal(reachable({ channel: 'C0C4RBW02Q1' }, ['CLV3KMZ8B', 'CD02L9Z1Q']), false);
  assert.equal(reachable({ channel: 'CLV3KMZ8B' }, ['CLV3KMZ8B', 'CD02L9Z1Q']), true);
  assert.equal(reachable({ channel: 'C1' }, []), true);
});

test('missed: replies after the last handled one, within the replay window', () => {
  const s = { thread_ts: '1000.000000', last_ts: '1900.000000' };
  const msgs = [
    { ts: '1000.000000', user: 'U1' },                       // the thread's first message
    { ts: '1900.000000', user: 'U1' },                       // already handled
    { ts: '1950.000000', user: 'U1' },                       // missed
    { ts: '1960.000000', user: 'U1', subtype: 'channel_join' },
    { ts: '1970.000000', user: 'U1', subtype: 'file_share' }, // missed, with a file
  ];
  assert.deepEqual(missed(s, msgs, 2000).map((m) => m.ts), ['1950.000000', '1970.000000']);
  assert.deepEqual(missed(s, msgs, 1950 + REPLAY_S).map((m) => m.ts), ['1970.000000'], 'older than the window: dropped');
  assert.deepEqual(missed({ thread_ts: '1000.000000' }, msgs, 2000), [], 'no mark and no start: nothing replays');
  assert.deepEqual(missed({ thread_ts: '1000.000000', started_at: 1960_000 }, msgs, 2000).map((m) => m.ts), ['1970.000000'], 'no reply handled yet: from the session start');
  assert.deepEqual(missed({ ...s, last_ts: '1975.000000' }, msgs, 2000, s.last_ts).map((m) => m.ts), ['1950.000000', '1970.000000'], 'the mark from before a live reply moved last_ts');
});
