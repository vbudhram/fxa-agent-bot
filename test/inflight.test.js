import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.FXA_AGENT_STATE = join(mkdtempSync(join(tmpdir(), 'inflight-')), 'sessions.json');
const { mark, clear, takeLeft } = await import('../src/inflight.js');

test('a quick look a restart cut off is returned once; a finished one is not', () => {
  mark('agent-q1', { channel: 'C1', thread_ts: '1.1', card_ts: '1.2' });
  mark('agent-q1', { status_ts: '1.3' });
  mark('agent-q2', { channel: 'C1', thread_ts: '2.1' });
  clear('agent-q2');
  assert.deepEqual(takeLeft(), [{ channel: 'C1', thread_ts: '1.1', card_ts: '1.2', status_ts: '1.3' }]);
  assert.deepEqual(takeLeft(), [], 'a second restart posts nothing');
});
