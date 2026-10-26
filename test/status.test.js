import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusMessage, planTasks, PLAN_MAX } from '../src/status.js';

test('a live status is one plan block: a task per row, a done task marked ✓, no command', () => {
  const m = statusMessage({ title: 'Working for Greg · 2m 14s', rows: ['✓ Got ready · 52s', '› Reading the code · 4 steps', '○ Post the reply'] });
  assert.equal(m.blocks.length, 1);
  const [p] = m.blocks;
  assert.equal(p.type, 'plan');
  assert.equal(p.title, 'Working for Greg · 2m 14s');
  assert.deepEqual(p.tasks.map((t) => [t.task_id, t.title, t.status]), [['t0', '✓ Got ready · 52s', 'complete'], ['t1', 'Reading the code · 4 steps', 'in_progress'], ['t2', 'Post the reply', 'pending']]);
  assert.ok(p.tasks.every((t) => !t.details));
  assert.match(m.text, /^Working for Greg · 2m 14s\n✓ Got ready · 52s/);
});

test('a status keeps one block_id across its edits, so a plan someone opened stays open', () => {
  const a = statusMessage({ title: 'x', rows: ['› a'], id: 'k1' }), b = statusMessage({ title: 'y', rows: ['✓ a', '› b'], id: 'k1' });
  assert.equal(a.blocks[0].block_id, 'plan-k1');
  assert.equal(b.blocks[0].block_id, a.blocks[0].block_id);
});

test('past the plan limit the oldest rows fold into one Earlier task', () => {
  const rows = [...Array.from({ length: PLAN_MAX + 2 }, (_, i) => `✓ Step ${i} · 2 steps`), '› Now · 1 step'];
  const t = planTasks(rows);
  assert.equal(t.length, PLAN_MAX);
  assert.match(t[0].title, /^✓ Earlier · Step 0, Step 1, Step 2, Step 3 · 8 steps$/);
  assert.equal(t.at(-1).status, 'in_progress');
});

test('a long title is cut to Slack\'s 150 characters, its ✓ included', () => {
  const [t] = planTasks([`✓ ${'x'.repeat(300)}`]);
  assert.equal(t.title.length, 150);
  assert.ok(t.title.startsWith('✓ x'));
});

test('a status with no rows is the title alone, with no plan', () => {
  const m = statusMessage({ title: 'In line for Greg · 2nd in line', rows: [] });
  assert.deepEqual(m.blocks, [{ type: 'section', text: { type: 'mrkdwn', text: 'In line for Greg · 2nd in line' } }]);
  assert.equal(m.text, 'In line for Greg · 2nd in line');
});
