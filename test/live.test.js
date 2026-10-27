import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, reduce, todoRows, currentRow, facts, summary, todoLine, openTodoLine, advanceRows, lineRows, progress, note, headline, clock, NOTE_MS, THINK_MS, lostContact, LOST_MS, GIVE_UP_MS, MAX_ROWS, lastNote } from '../src/live.js';

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
  assert.equal(facts(st), '2 files (+6 −2) · tests 44 passed, 1 failed · lint 2 errors · a subagent working');
});

test('facts: one running subagent is named, several are counted', () => {
  const one = [{ type: 'subagent_start', id: 's1', agent: 'fxa-explore', description: 'find it' }];
  assert.equal(facts(one.reduce(reduce, start())), 'fxa-explore working');
  assert.equal(facts([{ type: 'subagent_start', id: 's1', description: 'x' }].reduce(reduce, start())), 'a subagent working');
  assert.equal(facts([...one, { type: 'subagent_start', id: 's2', agent: 'fxa-reviewer' }].reduce(reduce, start())), '2 subagents working');
  assert.equal(facts([...one, { type: 'tool_done', id: 's1' }].reduce(reduce, start())), '');
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

test('status questions are recognized, other questions are not', async () => {
  const { isStatusAsk } = await import('../src/live.js');
  for (const t of ["What's the status?", 'what is the status here?', "What's up? Where we at?", 'status', 'any update?', 'how is it going?', 'where are we?', 'ok, status?'])
    assert.equal(isStatusAsk(t), true, t);
  for (const t of ['what happened?', 'does this work for sync logins and 123done sessions?', 'Can you see why?', 'update the README too', 'status of the PR checks in CI and what failed in the functional tests?',
    "what's happening with CI? can you rerun it", 'where are we storing the session token?', "what's up with the login test failing?", "how's it going with the refactor? also skip the docs"])
    assert.equal(isStatusAsk(t), false, t);
});

test('a status reply names the time, the todo in progress, the last step and the last note', async () => {
  const { statusReply } = await import('../src/live.js');
  const st = feed([todos(['Find it', 'completed'], ['Run verify', 'in_progress', 'Running verify'], ['Ship', 'pending']), { type: 'edit', file: 'a.ts', added: 3, removed: 1 }]);
  const out = statusReply(st, { elapsedMs: 12 * 60_000, lastStep: 'Running yarn `verify`', stepAgoMs: 4 * 60_000, said: 'Lint passes. The verification takes about 10 minutes.' });
  assert.equal(out, '⏳ Still working · 12m · 1/3 todos · 1 file (+3 −1)\n› Now: Running verify\n› Last step, 4m ago: `Running yarn \'verify\'`\n› Last note: _The verification takes about 10 minutes._');
  assert.equal(statusReply(start(), { elapsedMs: 30_000 }), '⏳ Still working · 1m');
});

test('a turn that ends with work left lists its todos, ticked and open', () => {
  const todos = (...ss) => reduce(start(), { type: 'todos', items: ss.map((x, i) => ({ content: `t${i}`, status: x })) });
  assert.equal(openTodoLine(todos('completed', 'pending')), '✓ t0  ·  ○ t1');
  assert.equal(openTodoLine(todos('completed', 'completed')), null);
  assert.equal(openTodoLine(start()), null);
});

test('the status line shows one row per stage with its time, the running one last', () => {
  const t = 1_000_000;
  let r = advanceRows({}, ['Reading a.ts', 'Searching for x'], t);
  r = advanceRows(r, ['Editing a.ts'], t + 70_000);
  r = advanceRows(r, ['Running npx jest a'], t + 95_000);
  r = advanceRows(r, ['Reading b.ts'], t + 125_000);
  assert.deepEqual(lineRows(start(), r, t + 130_000), ['✓ Made the change · 25s', '✓ Verified · 30s', '› Exploring the code · 1m']);
  // under a minute the running row has no time, so the clock alone never changes the rows
  assert.deepEqual(lineRows(start(), advanceRows({}, ['Running node x.js'], t), t + 59_000), ['› Exploring the code']);
  // a record from before this layout still renders
  assert.deepEqual(lineRows(start(), { rows_done: ['Exploring the code · 5 steps'], cur_kind: 'verify', cur_label: 'Verifying', cur_count: 1 }, t), ['› Verifying']);
  const todos = reduce(start(), { type: 'todos', items: [{ content: 'a', status: 'completed' }, { content: 'b', status: 'in_progress' }, { content: 'c', status: 'pending' }] });
  assert.deepEqual(lineRows(todos, r), ['✓ a', '› b', '○ c']);
  assert.equal(progress(todos), 'step 2 of 3');
  assert.equal(progress(start()), null);
});

test('the title says what the agent does: thinking, its recent note, else the todo or stage', () => {
  const rows = advanceRows({}, ['Running npx jest a'], 0);
  assert.equal(note('Found it: the title is **left** aligned. Now I center it.'), 'Found it: the title is left aligned');
  assert.equal(note('Still writing this sent'), '');
  assert.equal(note('Each <li> has py-2 & no test.'), 'Each li has py-2 no test');
  assert.ok(note(`${'word '.repeat(40)}end.`).length <= 71);
  assert.equal(headline(start(), rows, { said: 'Running the unit tests.', saidAgoMs: 1000 }), 'Running the unit tests');
  assert.equal(headline(start(), rows, { said: 'Running the unit tests.', saidAgoMs: NOTE_MS }), 'Verifying');
  assert.equal(headline(start(), rows, { said: 'Running the unit tests.', saidAgoMs: 1000, thinkMs: THINK_MS }), 'Thinking');
  assert.equal(headline(start(), rows, { thinkMs: THINK_MS - 1 }), 'Verifying');
  const todos = reduce(start(), { type: 'todos', items: [{ content: 'a', status: 'completed' }, { content: 'b', status: 'in_progress', active: 'Doing b' }] });
  assert.equal(headline(todos, rows), 'Doing b');
  assert.equal(headline(reduce(start(), { type: 'todos', items: [{ content: 'a', status: 'completed' }] }), rows), 'Finishing up');
  assert.equal(headline(start(), {}), null);
  assert.equal(clock(59_400), '59s'); assert.equal(clock(195_000), '3m');
});

test('lost contact: one warning, a recovery, one give-up, and quiet for a short blip', () => {
  let r = lostContact(null, false, 0);
  assert.equal(r.show, null);
  r = lostContact(r.st, false, LOST_MS - 1); assert.equal(r.show, null);
  r = lostContact(r.st, false, LOST_MS); assert.equal(r.show, 'warn');
  r = lostContact(r.st, false, LOST_MS + 5000); assert.equal(r.show, null);
  assert.equal(lostContact(r.st, true, LOST_MS + 6000).show, 'recover');
  r = lostContact(r.st, false, GIVE_UP_MS); assert.equal(r.show, 'give_up');
  assert.equal(lostContact(r.st, false, GIVE_UP_MS + 60_000).show, null);
  assert.equal(lostContact(r.st, true, GIVE_UP_MS + 70_000).show, null);
  assert.equal(lostContact({ since: 0, warned: false }, true, 30_000).show, null);
});

test('the git diffstat replaces the files that Edit calls added up', () => {
  let st = reduce(start(), { type: 'edit', file: 'a.ts', added: 5, removed: 0 });
  st = reduce(st, { type: 'diffstat', files: [{ file: 'a.ts', added: 3, removed: 1 }, { file: 'b.ts', added: 7, removed: 2 }, { file: 'c.ts', added: 1, removed: 0 }] });
  assert.equal(facts(st), '3 files (+11 −3)');
  // An edit after it adds on top, until the next diffstat corrects it.
  st = reduce(st, { type: 'edit', file: 'd.ts', added: 2, removed: 0 });
  assert.equal(facts(st), '4 files (+13 −3)');
  st = reduce(st, { type: 'diffstat', files: [] });
  assert.equal(facts(st), '');
});

test('the last note is the last sentence of what the agent said', () => {
  assert.equal(lastNote('The spec passes now. The Storybook build takes about 3 to 6 minutes.'), 'The Storybook build takes about 3 to 6 minutes.');
  assert.equal(lastNote(''), '');
  assert.equal(lastNote(undefined), '');
});
