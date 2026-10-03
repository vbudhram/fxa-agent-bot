import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quickFirst, askId, answerBlocks, findingsOf, stepRows, lastRow, doneLine, FIRST_ROW } from '../src/answer.js';

test('questions get a quick answer first; plain work requests go to a sandbox', () => {
  for (const q of ['where is the password change event recorded?', 'review https://github.com/mozilla/fxa/pull/1', 'which tests cover TOTP, and what gaps?', 'explain the smart window project'])
    assert.equal(quickFirst(q), true, q);
  for (const q of ['fix the wrong error on change password', 'run the functional tests', 'rebase this PR and push', 'record a video of sign in', 'start a sandbox', 'open a PR for it', 'build a Pac-Man RP'])
    assert.equal(quickFirst(q), false, q);
});

test('only the request decides, not the thread context after it', () => {
  assert.equal(quickFirst('what does this do?\n\nEarlier messages in this Slack thread:\n> please fix it'), true);
});

test('a resumed session, Codex, or the switch off skips the quick answer', () => {
  assert.equal(quickFirst('where is X?', { resuming: true }), false);
  assert.equal(quickFirst('where is X?', { runtime: 'codex' }), false);
  assert.equal(quickFirst('where is X?', { on: false }), false);
});

test('the ask id follows the session key', () => assert.equal(askId('agent-7f3a9c'), 'ask-7f3a9c'));

test('the reply says nothing about how it was made', () => {
  assert.deepEqual(answerBlocks({ answer: 'In `auth.ts:12`.', secs: 18 }).map((b) => b.type), ['markdown']);
});

test('the session gets the findings and the reply so far', () => {
  assert.equal(findingsOf({ answer: 'At index.tsx:73.', upgrade: { findings: 'index.tsx:73-81' } }), 'index.tsx:73-81\n\nIts reply so far:\nAt index.tsx:73.');
});

test('steps become the rows a sandbox turn shows: a row per stage, a count within it', () => {
  let st = { t: 0, kind: null, label: FIRST_ROW, count: 0 };
  let r = stepRows(st, 'Searching for `changePassword`');
  assert.deepEqual(r.chunks.map((c) => [c.id, c.title, c.status]), [['t0', 'Working on it', 'complete'], ['t1', 'Exploring the code · 1', 'in_progress']]);
  r = stepRows(r.st, 'Reading `password.ts`');
  assert.deepEqual(r.chunks.map((c) => [c.id, c.title, c.details]), [['t1', 'Exploring the code · 2', '`password.ts`']]);
  assert.deepEqual(lastRow(r.st), { type: 'task_update', id: 't1', title: 'Exploring the code · 2', status: 'complete' });
});

test('the summary line matches a sandbox turn', () => {
  assert.equal(doneLine('Done', 4, 14_000, 19_000), 'Done · 4 steps · 14s · reply 19s after your message');
  assert.equal(doneLine('Done', 1, 61_000), 'Done · 1 step · 1m 1s');
});
