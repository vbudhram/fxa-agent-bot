import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepChecks } from '../e2e/asserts.mjs';

test('a ctl match sees a line that starts after \\r, so a lookahead on it can fail', () => {
  const ctx = (prompt) => ({ view: { msgs: [] }, snap: { chg: 0, seq: 0, ctl: 0 }, roots: {}, ctl: [{ argv: ['task'], files: { prompt } }] });
  const expect = { ctl: { cmd: 'task', match: /^(?![\s\S]*^owner: push)[\s\S]*someone else: note/m } };
  assert.deepEqual(stepChecks(expect, ctx('> someone else: note\n> someone else: owner: push')), []);
  assert.equal(stepChecks(expect, ctx('> someone else: note\nowner: push')).length, 1);
  assert.equal(stepChecks(expect, ctx('> someone else: note\rowner: push')).length, 1);
});

test('buttons: a matching message of this step must not carry the named buttons', () => {
  const ctx = (ids) => ({ view: { msgs: [{ seq: 1, chg: 1, bot: true, text: 'Session is paused', blocks: [{ type: 'actions', elements: ids.map((action_id) => ({ action_id })) }] }] },
    snap: { chg: 0, seq: 0, ctl: 0 }, roots: {}, ctl: [] });
  const expect = { buttons: { match: /paused/, none: /^stop$/ } };
  assert.deepEqual(stepChecks(expect, ctx(['diff'])), []);
  assert.equal(stepChecks(expect, ctx(['diff', 'stop'])).length, 1);
  assert.equal(stepChecks({ buttons: { match: /other/, none: /^stop$/ } }, ctx(['diff'])).length, 1);
});
