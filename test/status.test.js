import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusMessage, planTasks, PLAN_MAX } from '../src/status.js';

test('a live status is one plan block: a task per row, the current command under the running task', () => {
  const m = statusMessage({ title: 'Working for Greg · 2m 14s', rows: ['✓ Got ready · 52s', '› Reading the code · 4 steps', '○ Post the reply'], cmd: 'rg --files src' });
  assert.equal(m.blocks.length, 1);
  const [p] = m.blocks;
  assert.equal(p.type, 'plan');
  assert.equal(p.title, 'Working for Greg · 2m 14s');
  assert.deepEqual(p.tasks.map((t) => [t.task_id, t.title, t.status]), [['t0', 'Got ready · 52s', 'complete'], ['t1', 'Reading the code · 4 steps', 'in_progress'], ['t2', 'Post the reply', 'pending']]);
  assert.equal(p.tasks[1].details.elements[0].elements[0].text, 'rg --files src');
  assert.equal(p.tasks[1].details.elements[0].elements[0].style.code, true);
  assert.ok(!p.tasks[0].details && !p.tasks[2].details);
  assert.match(m.text, /^Working for Greg · 2m 14s\n✓ Got ready · 52s/);
});

test('each edit gets a new block_id, as Slack asks for a plan', () => {
  const a = statusMessage({ title: 'x', rows: ['› a'] }), b = statusMessage({ title: 'x', rows: ['› a'] });
  assert.notEqual(a.blocks[0].block_id, b.blocks[0].block_id);
});

test('past the plan limit the oldest rows fold into one Earlier task', () => {
  const rows = [...Array.from({ length: PLAN_MAX + 2 }, (_, i) => `✓ Step ${i} · 2 steps`), '› Now · 1 step'];
  const t = planTasks(rows, 'ls');
  assert.equal(t.length, PLAN_MAX);
  assert.match(t[0].title, /^Earlier · Step 0, Step 1, Step 2, Step 3 · 8 steps$/);
  assert.equal(t.at(-1).status, 'in_progress');
});

test('a long command is cut to one short line', () => {
  const [t] = planTasks(['› Running · 1 step'], 'x'.repeat(300));
  assert.ok(t.details.elements[0].elements[0].text.length <= 90);
});

test('a status with no rows is the title alone, with no plan', () => {
  const m = statusMessage({ title: 'In line for Greg · 2nd in line', rows: [] });
  assert.deepEqual(m.blocks, [{ type: 'section', text: { type: 'mrkdwn', text: 'In line for Greg · 2nd in line' } }]);
  assert.equal(m.text, 'In line for Greg · 2nd in line');
});
