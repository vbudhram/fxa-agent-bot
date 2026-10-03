import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quickFirst, askId, answerBlocks, upgradeText, upgradeBlocks, findingsOf } from '../src/answer.js';

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

test('an answer renders with a footer that says what it was', () => {
  const b = answerBlocks({ answer: 'In `auth.ts:12`.', secs: 18 });
  assert.equal(b[0].type, 'markdown');
  assert.match(b[1].elements[0].text, /read-only look at main, in 18 s/);
});

test('an upgrade says why, and hands the session the findings and the reply', () => {
  const res = { answer: 'The check is at index.tsx:73.', upgrade: { reason: 'it needs a code change', findings: 'index.tsx:73-81' } };
  assert.equal(upgradeText(res.upgrade), 'This needs a sandbox: it needs a code change. Starting one now, with what I found so far.');
  assert.equal(upgradeBlocks(res).length, 2);
  assert.equal(findingsOf(res), 'index.tsx:73-81\n\nIts reply so far:\nThe check is at index.tsx:73.');
  assert.equal(upgradeBlocks({ answer: '', upgrade: { reason: 'x.' } }).length, 1);
});
