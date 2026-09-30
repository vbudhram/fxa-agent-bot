import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pollEvery, IDLE_MS } from '../src/poll.js';

test('a session waiting for its person polls slowly; one with work polls every 5 s', () => {
  const now = 1_000_000;
  assert.equal(pollEvery({ state: 'active' }, now, 0), IDLE_MS);
  assert.equal(pollEvery({ state: 'active', status_ts: '1.2' }, now, 0), 5_000); // a turn is running
  assert.equal(pollEvery({ state: 'starting' }, now, 0), 5_000);
  assert.equal(pollEvery({ state: 'wrapping' }, now, 0), 5_000);
  assert.equal(pollEvery({ state: 'active' }, now, now - 30_000), 5_000); // work 30 s ago: a queued turn may start
  assert.equal(pollEvery({ state: 'active' }, now, now - IDLE_MS), IDLE_MS);
});
