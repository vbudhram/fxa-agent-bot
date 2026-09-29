import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, reduce, todoRows, currentRow, changedRows, facts, summary, todoLine, MAX_ROWS } from '../src/live.js';

const feed = (evs) => evs.reduce(reduce, start());
const todos = (...s) => ({ type: 'todos', items: s.map(([content, status, active]) => ({ content, status, active })) });

test('todos become rows, the one in progress titled by its active form', () => {
  const st = feed([todos(['Find it', 'completed'], ['Fix it', 'in_progress', 'Fixing it'], ['Test it', 'pending'])]);
  assert.deepEqual(todoRows(st), [
    { id: 'd0', title: 'Find it', status: 'complete' },
    { id: 'd1', title: 'Fixing it', status: 'in_progress' },
    { id: 'd2', title: 'Test it', status: 'pending' }]);
  assert.equal(currentRow(todoRows(st)), 'd1');
});

test('a later todo list replaces the earlier one, and only changed rows are sent', () => {
  const a = todoRows(feed([todos(['Find it', 'in_progress', 'Finding it'], ['Fix it', 'pending'])]));
  const first = changedRows({}, a);
  assert.equal(first.rows.length, 2);
  const b = todoRows(feed([todos(['Find it', 'completed'], ['Fix it', 'pending'])]));
  const second = changedRows(first.sent, b);
  assert.deepEqual(second.rows, [{ id: 'd0', title: 'Find it', status: 'complete' }]);
});

test('an un-ticked todo goes back to in progress', () => {
  const st = feed([todos(['Find it', 'completed']), todos(['Find it', 'in_progress', 'Finding it again'])]);
  assert.deepEqual(todoRows(st)[0], { id: 'd0', title: 'Finding it again', status: 'in_progress' });
});

test('a long list stays under the Slack row limit', () => {
  const st = feed([todos(...Array.from({ length: 60 }, (_, i) => [`todo ${i}`, 'pending']))]);
  const rows = todoRows(st);
  assert.equal(rows.length, MAX_ROWS);
  assert.equal(rows.at(-1).title, '… 21 more');
});

test('titles are clipped to 250 characters and cannot ping', () => {
  const st = feed([todos(['<!channel> ' + 'x'.repeat(400), 'pending'])]);
  const t = todoRows(st)[0].title;
  assert.equal(t.length, 250);
  assert.ok(t.startsWith('@channel '));
});

test('facts: files with line counts, tests, lint and type errors, running subagents', () => {
  const st = feed([
    { type: 'edit', file: 'a.ts', added: 3, removed: 2 }, { type: 'edit', file: 'a.ts', added: 1, removed: 0 }, { type: 'edit', file: 'b.ts', added: 2, removed: 0 },
    { type: 'tests', passed: 44, failed: 1 }, { type: 'lint', errors: 2, warnings: 1 }, { type: 'types', errors: 0 },
    { type: 'subagent_start', id: 's1', description: 'find the limiter' }, { type: 'subagent_start', id: 's2', description: 'x' }, { type: 'tool_done', id: 's2' }]);
  assert.equal(facts(st), '2 files (+6 −2) · tests 44 passed, 1 failed · lint 2 errors · 1 subagent working');
});

test('the summary counts todos and leaves subagents out', () => {
  const st = feed([todos(['a', 'completed'], ['b', 'completed'], ['c', 'pending']), { type: 'tests', passed: 12, failed: 0 },
    { type: 'subagent_start', id: 's1', description: 'x' }]);
  assert.equal(summary(st), '2/3 todos · tests 12 passed');
  assert.equal(todoLine(st), '✓ a  ·  ✓ b  ·  ○ c');
});

test('a turn with no todos has no rows and no todo line', () => {
  const st = feed([{ type: 'edit', file: 'a.ts', added: 1, removed: 1 }]);
  assert.deepEqual(todoRows(st), []);
  assert.equal(todoLine(st), null);
  assert.equal(summary(st), '1 file (+1 −1)');
});

test('unknown events and an edit without a file change nothing', () => {
  const st = start();
  assert.equal(reduce(st, { type: 'step', text: 'x' }), st);
  assert.equal(reduce(st, { type: 'edit', file: '' }), st);
});
