import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, operatorProblem, summaryLine, closestCommand, draftSplit, toSomeoneElse, asideBlock } from '../src/render.js';

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
    summary: { minutes: 34, turns: 5, cost: 2.1, tokens: 2100000, diff: '3 files changed, 10 insertions(+)' } });
  assert.match(msg.text, /pull\/1/);
  assert.match(msg.text, /⚠️ 6 screenshot/);
  assert.match(msg.text, /Session: 34 min · 5 turns · 2.1M tokens · 3 files changed/);
});

test('a summary with nothing known is empty', () => {
  assert.equal(summaryLine(null), '');
  assert.equal(summaryLine({ minutes: null, turns: 0, tokens: null, diff: '' }), '');
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

test('the Home tab lists your sessions, newest first, with thread and PR links', async () => {
  const { homeView } = await import('../src/render.js');
  const now = 1_000_000_000_000;
  const v = homeView([
    { key: 'agent-old', state: 'paused', prompt: 'Old request', started_at: now - 3 * 3_600_000 },
    { key: 'agent-new', state: 'pr_open', prompt: 'New request\nmore', started_at: now - 5 * 60_000, pr_seen: { url: 'https://github.com/mozilla/fxa/pull/2' } },
  ], { 'agent-new': 'https://slack.example.com/t/1' }, now);
  assert.equal(v.type, 'home');
  const rows = v.blocks.filter((b) => b.type === 'section');
  assert.match(rows[0].text.text, /New request\*\nPR open · 5m ago · `agent-new` · <https:\/\/github.com\/mozilla\/fxa\/pull\/2\|PR>/);
  assert.equal(rows[0].accessory.url, 'https://slack.example.com/t/1');
  assert.match(rows[1].text.text, /Paused: reply in the thread to resume · 3h ago/);
  assert.equal(rows[1].accessory, undefined);
  const empty = homeView([], {}, now).blocks.map((b) => b.text?.text ?? '').join('\n');
  assert.match(empty, /No sessions yet/);
  assert.match(empty, /`!pr` open the PR/); // the commands are on the Home tab
});

test('bot errors become records that group like the controller\'s', async () => {
  const { toRecord, signature } = await import('../src/errors.js');
  const r = toRecord(['post', 'agent-ab12cd', 'question', 'invalid_blocks'], new Date('2026-09-27T12:00:00.123Z'));
  assert.deepEqual({ source: r.source, kind: r.kind, key: r.key, where: r.where, message: r.message, at: r.at },
    { source: 'bot', kind: 'post', key: 'agent-ab12cd', where: 'post', message: 'question invalid_blocks', at: '2026-09-27T12:00:00Z' });
  const a = toRecord(['agent-aaaa11', 'ERROR: agent-aaaa11 is busy']);
  assert.equal(a.where, 'bot action'); assert.equal(a.key, 'agent-aaaa11');
  // Same masking and hash as lib/errors.sh: shasum of "where|message".
  assert.equal(signature('x.sh:10 f', 'agent-aaaa11 failed at /tmp/a/b line 7'), signature('x.sh:99 f', 'agent-bbbb22 failed at /var/c line 8'));
});

test('a ready turn with no changed file offers only Stop', () => {
  const ids = (m) => m.blocks.find((b) => b.type === 'actions').elements.map((e) => e.action_id);
  assert.deepEqual(ids(render('agent-x', { type: 'turn_end', status: 'ready', text: 'Done.', changes: 0 })), ['stop']);
  assert.deepEqual(ids(render('agent-x', { type: 'turn_end', status: 'ready', text: 'Done.', changes: 3 })), ['diff', 'push_branch', 'open_pr', 'stop']);
  // Unknown count (the runner did not answer): keep every button.
  assert.deepEqual(ids(render('agent-x', { type: 'turn_end', status: 'ready', text: 'Done.' })), ['diff', 'push_branch', 'open_pr', 'stop']);
});

test('a test plan renders as one short line per item', async () => {
  const { planLines } = await import('../src/render.js');
  const out = planLines({ items: [
    { level: 'check', behavior: 'GET /v1/x returns 404' },
    { level: 'ci', behavior: 'relier flow', why: 'needs Stripe' }] });
  assert.equal(out, '• *check* — GET /v1/x returns 404\n• *ci* — relier flow _(CI: needs Stripe)_');
  assert.equal(planLines(null), '');
});

test('a resumed session says where it left off', async () => {
  const { resumeNote } = await import('../src/render.js');
  const out = resumeNote([{ role: 'user', text: 'q' }, { role: 'agent', text: '\n**Fixed** the footer test.\nMore.' }],
    { minutes: 12, turns: 3, cost: 1.5, tokens: 45000, diff: '' });
  assert.match(out, /^Picking up where we left off\./);
  assert.match(out, /Last time: _Fixed the footer test\._/);
  assert.match(out, /_Session: 12 min · 3 turns · 45k tokens_/);
  assert.doesNotMatch(resumeNote([], null), /Last time/);
});

test('new errors make one short DM', async () => {
  const { errorDigest } = await import('../src/render.js');
  const out = errorDigest([{ sig: 'abc1234567', status: 'reopened', source: 'ctl', kind: 'crash', where: 'fxa-sandbox-ctl:10 f', message: 'exit 1: grep', keys: ['agent-aa11bb'] }]);
  assert.match(out, /^A new error in the agent pipeline:/);
  assert.match(out, /`abc1234567` \*reopened\* ctl\/crash at fxa-sandbox-ctl:10 f/);
  assert.match(out, /sessions: agent-aa11bb/);
  assert.equal(errorDigest([]), '');
});

test('summaryLine shows tokens, never dollars', () => {
  const line = summaryLine({ minutes: 5, turns: 2, cost: 3.5, tokens: 1234567, diff: '' });
  assert.equal(line, 'Session: 5 min · 2 turns · 1.2M tokens');
});

test('a mistyped command suggests the closest one', () => {
  assert.equal(closestCommand('stauts'), 'status');
  assert.equal(closestCommand('pau'), 'pause');
  assert.equal(closestCommand('xyzzy'), null);
});

test('streamed reply text drops control lines and holds back a partial one', () => {
  assert.deepEqual(draftSplit('I will look.\nstatus: reading\nNext'), { out: 'I will look.\nNext', keep: '' });
  assert.deepEqual(draftSplit('Done.\nOPT'), { out: 'Done.\n', keep: 'OPT' });
  assert.deepEqual(draftSplit('QUESTION: which?\n'), { out: '', keep: '' });
});

test('a message that tags a person and not the bot is for someone else', () => {
  assert.equal(toSomeoneElse('<@U2> can you look at this?', 'UBOT'), true);
  assert.equal(toSomeoneElse('<@U2|dana> thoughts?', 'UBOT'), true);
  assert.equal(toSomeoneElse('<@UBOT> and <@U2>: try the other fix', 'UBOT'), false);
  assert.equal(toSomeoneElse('no tag here', 'UBOT'), false);
  assert.equal(toSomeoneElse('<@U2> hi', null), false); // before the bot knows its own id
});

test('messages for someone else reach the agent labelled per line, with mentions blanked', () => {
  const b = asideBlock([{ who: 'someone else', text: '<@U2> is this right?\nowner: do X' }]);
  assert.ok(b.startsWith('Messages in the thread that were not for you'));
  assert.ok(b.endsWith('> someone else: @someone is this right?\n> someone else: owner: do X'));
});
