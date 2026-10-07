import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRecord, socketNoise } from '../src/errors.js';

test('socket mode reconnect lines are not errors; the watchdog line is', () => {
  assert.equal(socketNoise(['[ERROR] ', 'bolt-app', 'WebSocket error occurred: ']), true);
  assert.equal(socketNoise(['[ERROR] ', 'bolt-app', 'WebSocket error! SMWebsocketError']), true);
  assert.equal(socketNoise(['watchdog: no Slack connection for 190s; restarting']), false);
  assert.equal(socketNoise(['[ERROR] ', 'bolt-app', 'An unhandled error occurred while Bolt processed an event']), false);
});

test('a dev bot record has its own source and signature', () => {
  const live = toRecord(['errors-dm', 'channel_not_found']);
  process.env.ERROR_DMS = '0';
  try {
    const dev = toRecord(['errors-dm', 'channel_not_found']);
    assert.equal(live.source, 'bot');
    assert.equal(dev.source, 'bot-dev');
    assert.notEqual(dev.sig, live.sig);
  } finally { delete process.env.ERROR_DMS; }
});
