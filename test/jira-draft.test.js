import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asksForJira, JIRA_YES, draftCard, filedCard, changedCard, editModal, readEdit } from '../src/jira-draft.js';
import { mayTap } from '../src/access.js';

const ids = (c) => c.blocks.filter((b) => b.type === 'actions').flatMap((b) => b.elements.map((e) => e.action_id));
const d = { project: 'FXA', type: 'Bug', summary: 'Sign-in *times out*', description: 'See <https://evil.example|docs> & <!channel>\n```x```', sha: 'a'.repeat(64),
  dups: [{ key: 'FXA-1', summary: 'Sign-in timeout' }] };

test('a clear request in words counts; talk about tickets does not', () => {
  for (const t of ['file a ticket for this', 'Can you create a Jira for the timeout?', 'please open an issue', 'make a jira ticket', 'log a bug report'])
    assert.ok(asksForJira(t), t);
  for (const t of ['we should track this', 'is there a ticket?', 'the ticket says otherwise', 'fix the issue', 'go ahead', 'add tests for the summary component', 'make sure the bug is fixed', 'add a fix for the bug', '', undefined])
    assert.ok(!asksForJira(t), String(t));
  for (const t of ['File a bug for it', 'Now file two more tickets: one for X', 'file the second one too', 'open a story for the toggle', 'yes, file it', 'file that', 'add the label rate-limit to that ticket', 'change the summary of that ticket to X', 'remove the sync label from FXA-12', 'rename the ticket'])
    assert.ok(asksForJira(t), t);
});

test('only a short, whole reply of agreement files the draft card', () => {
  for (const t of ['yes', 'Go ahead.', 'ok thanks', 'sounds good!', 'do it please', 'LGTM']) assert.ok(JIRA_YES.test(t), t);
  for (const t of ['yes but change the title', 'ok, what about the other bug?', 'go ahead and fix the code', 'not yet']) assert.ok(!JIRA_YES.test(t), t);
});

test('a change waits on a card with Apply and Discard, and shows only what changes', () => {
  const ch = { op: 'change', project: 'FXA', key: 'FXA-9', labels: ['ui'], remove_labels: ['sync'], summary: 'New *title*', sha: 'b'.repeat(64), dups: [] };
  const c = draftCard(ch, 'agent-a1', { jiraUrl: 'https://jira.example.com' });
  assert.deepEqual(ids(c), ['jira_create', 'jira_discard']);
  const text = JSON.stringify(c.blocks);
  assert.match(text, /FXA-9/);
  assert.match(text, /Add labels: ui/);
  assert.match(text, /Remove labels: sync/);
  assert.doesNotMatch(text, /\*title\*/, 'the summary cannot add markup');
  assert.doesNotMatch(text, /Type:|description/i, 'no line for what does not change');
  const done = changedCard(ch, 'U1', '');
  assert.deepEqual(ids(done), []);
  assert.match(JSON.stringify(done.blocks), /Changed FXA-9 by <@U1>/);
});

test('the draft card shows the exact text in a code block, with no link or mention, and its buttons carry the sha', () => {
  const c = draftCard(d, 'agent-a1', { privateChannel: true, jiraUrl: 'https://jira.example.com' });
  const body = c.blocks[1].text.text;
  assert.match(body, /^```[\s\S]*```$/);
  assert.doesNotMatch(body, /<https|<!channel>/);
  assert.match(body, /&lt;https:\/\/evil\.example\|docs&gt; &amp;/);
  assert.equal(body.match(/```/g).length, 2, 'a fence in the text cannot close the block');
  assert.deepEqual(ids(c), ['jira_create', 'jira_create_fixme', 'jira_edit', 'jira_discard']);
  assert.ok(c.blocks.at(-1).elements.every((e) => e.value === `agent-a1|${'a'.repeat(64)}`));
  assert.match(JSON.stringify(c.blocks), /This thread is private/);
  assert.match(JSON.stringify(c.blocks), /FXA-1/);
  const lc = JSON.stringify(draftCard({ ...d, labels: ['sync', '<!here>'] }, 'agent-a1').blocks);
  assert.match(lc, /Labels: sync, /);
  assert.doesNotMatch(lc, /<!here>/, 'a label cannot ping the channel');
  assert.match(JSON.stringify(filedCard({ key: 'k', ticket: 'FXA-9', project: 'FXA', summary: 's', by: 'U1', labels: ['ui'] }).blocks), /Labels: ui/);
  assert.doesNotMatch(c.blocks[0].text.text, /\*times out\*/, 'the summary cannot add markup');
});

test('the filed card: Undo until it is too late, and no Queue once queued', () => {
  const f = { key: 'agent-a1', ticket: 'FXA-9', project: 'FXA', summary: 's', by: 'U1', dups: [] };
  assert.deepEqual(ids(filedCard(f)), ['jira_undo', 'jira_edit_filed', 'jira_queue']);
  assert.deepEqual(ids(filedCard({ ...f, undo: false, fixme: true })), ['jira_edit_filed']);
  assert.equal(filedCard(f).blocks.at(-1).elements[0].value, 'agent-a1|FXA-9|U1');
  assert.doesNotMatch(JSON.stringify(filedCard(f).blocks), /This thread is private/);
});

test('the edit form keeps the limits and reads back as a draft', () => {
  const m = editModal({ ...d, summary: 'x'.repeat(300) }, { key: 'agent-a1', sha: d.sha });
  assert.equal(m.blocks[1].element.initial_value.length, 200);
  assert.equal(m.blocks[2].element.max_length, 2800);
  assert.deepEqual(JSON.parse(m.private_metadata), { key: 'agent-a1', sha: d.sha });
  assert.deepEqual(readEdit({ type: { v: { selected_option: { value: 'Bug' } } }, summary: { v: { value: 'A' } }, description: { v: { value: 'B' } }, labels: { v: { value: 'sync, frontend  x' } } }),
    { type: 'Bug', summary: 'A', description: 'B', labels: ['sync', 'frontend', 'x'] });
  assert.equal(readEdit({ labels: { v: { value: null } } }).labels.length, 0, 'an empty labels field is no labels');
  const ml = editModal({ ...d, labels: ['sync', 'ui'] }, { key: 'agent-a1', sha: d.sha });
  assert.equal(ml.blocks[3].element.initial_value, 'sync, ui');
  assert.equal(ml.blocks[3].optional, true);
  assert.equal(editModal(d, { key: 'agent-a1', sha: d.sha }).blocks[3].element.initial_value, undefined, 'Slack refuses an empty initial value');
});

test('the Jira buttons go as far as steering does', () => {
  for (const a of ['jira_create', 'jira_undo', 'jira_queue']) {
    assert.ok(mayTap(a, 'UO', 'UT', true, true, true), `${a}: a teammate who may steer`);
    assert.ok(!mayTap(a, 'UO', 'UT', true, false, true), `${a}: not under STEER=owner`);
    assert.ok(!mayTap(a, 'UO', 'UX', false, true, true), `${a}: not someone the channel refuses`);
  }
});
