import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, operatorProblem, summaryLine } from '../src/render.js';

test('operator problems are named, other errors are not', () => {
  assert.equal(operatorProblem('ERROR: (gcloud.compute.ssh) Reauthentication failed. cannot prompt').kind, 'gcloud');
  assert.equal(operatorProblem('I stopped without replying. The last output was: OAuth token has expired.').kind, 'claude');
  assert.equal(operatorProblem('ERROR: could not mint a GitHub App installation token.').kind, 'github-app');
  assert.equal(operatorProblem('yarn test failed in fxa-settings'), null);
});

test('an operator error renders the plain message and its kind', () => {
  const msg = render('agent-x', { type: 'error', text: 'Reauthentication failed' });
  assert.equal(msg.operator, 'gcloud');
  assert.match(msg.text, /gcloud auth login/);
});

test('the PR message carries its notes and the session summary', () => {
  const msg = render('agent-x', { type: 'pr', url: 'https://github.com/mozilla/fxa/pull/1',
    notes: ['6 screenshot(s) did not upload, so the PR is missing them.'],
    summary: { minutes: 34, turns: 5, cost: 2.1, diff: '3 files changed, 10 insertions(+)' } });
  assert.match(msg.text, /pull\/1/);
  assert.match(msg.text, /⚠️ 6 screenshot/);
  assert.match(msg.text, /Session: 34 min · 5 turns · \$2\.10 · 3 files changed/);
});

test('a summary with nothing known is empty', () => {
  assert.equal(summaryLine(null), '');
  assert.equal(summaryLine({ minutes: null, turns: 0, cost: null, diff: '' }), '');
});

test('PR follow-up posts only what changed', async () => {
  const { prChanges } = await import('../src/render.js');
  const url = 'https://github.com/mozilla/fxa/pull/1';
  const running = { url, state: 'OPEN', ci: 'running', failing: [], infra: [], reviews: [] };
  assert.deepEqual(prChanges(null, running), []);
  const infraRed = { ...running, ci: 'fail', failing: ['extract'], infra: ['extract'] };
  const [line] = prChanges(running, infraRed);
  assert.match(line, /CI failed: extract\. That is a known failure/);
  assert.deepEqual(prChanges(infraRed, infraRed), []);
  const reviewed = { ...infraRed, reviews: [{ login: 'rev1', state: 'APPROVED' }] };
  assert.deepEqual(prChanges(infraRed, reviewed), ['rev1 approved the PR.']);
  assert.deepEqual(prChanges(reviewed, { ...reviewed, state: 'MERGED' }), ['The PR merged. 🎉']);
});

test('several questions get their own options and buttons', () => {
  const msg = render('agent-x', { type: 'question', text: 'Intro',
    questions: [{ q: 'Where?', options: ['Throwaway', 'Storybook'] }, { q: 'Which?', options: ['All three', 'Change one', 'Only A'] }] });
  const ids = msg.blocks.map((b) => b.block_id ?? b.type);
  assert.deepEqual(ids, ['markdown', 'q_0', 'answers_0', 'q_1', 'answers_1', 'answer_hint']);
  assert.equal(msg.blocks[4].elements.length, 3);
  assert.deepEqual(JSON.parse(msg.blocks[4].elements[2].value), { key: 'agent-x', q: 1, choice: 'Only A' });
  assert.match(msg.blocks[1].text.text, /^\*1\. Where\?\*\n\*1\*  Throwaway\n\*2\*  Storybook$/);
});

test('one question keeps its options list apart from the text', () => {
  const msg = render('agent-x', { type: 'question', text: '1. old list', options: ['a', 'b'] });
  assert.deepEqual(msg.blocks.map((b) => b.block_id ?? b.type), ['markdown', 'answer_opts', 'actions', 'answer_hint']);
});
