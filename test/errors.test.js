import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRecord, socketNoise, slackRetry } from '../src/errors.js';

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

test('slackRetry stops at once on an error from the bot data, and lets network and rate limit errors retry', () => {
  const wrap = (original) => Object.assign(new Error(original.message), { code: 'slack_webapi_request_error', original });
  assert.throws(() => slackRetry(new URIError('URI malformed')), URIError);
  assert.throws(() => slackRetry(wrap(new URIError('URI malformed'))), (e) => e instanceof URIError);
  assert.throws(() => slackRetry(wrap(new RangeError('Invalid string length'))), RangeError);
  assert.doesNotThrow(() => slackRetry(wrap(new TypeError('fetch failed'))));
  assert.doesNotThrow(() => slackRetry(wrap(new Error('A rate limit was exceeded (url: x, retry-after: 3)'))));
  assert.doesNotThrow(() => slackRetry(Object.assign(new Error('An HTTP protocol error occurred'), { code: 'slack_webapi_http_error' })));
});

test('a ctl failure with no stderr records the exit and the stdout tail, not the argv', () => {
  const e = Object.assign(new Error('Command failed: /x/ctl task --owner-name bob'), { cmd: '/x/ctl', code: 1, stderr: '', stdout: 'starting\nERROR: no slot\n' });
  const m = toRecord(['session start', 'agent-abc123', e]).message;
  assert.match(m, /exit 1/); assert.match(m, /no slot/); assert.doesNotMatch(m, /owner-name/);
  const k = Object.assign(new Error('Command failed: /x/ctl task'), { cmd: '/x/ctl', killed: true, signal: 'SIGTERM', stderr: '', stdout: '' });
  assert.match(toRecord(['session start', k]).message, /timed out: no output/);
});
