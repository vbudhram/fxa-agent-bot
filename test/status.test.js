import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusMessage, boxLines, BOX_LINES } from '../src/status.js';

const box = (m) => m.blocks.find((b) => b.type === 'rich_text')?.elements[0].elements[0].text;

test('a live status is a title line and a box of exactly 5 lines, the current command under the current row', () => {
  const m = statusMessage({ title: 'Working for <@U1> · 2m 14s', rows: ['✓ Got ready', '› Reading the code · 4 steps'], cmd: 'rg --files src' });
  assert.equal(m.blocks[0].type, 'section');
  assert.equal(m.blocks[0].text.text, 'Working for <@U1> · 2m 14s');
  assert.equal(m.blocks[1].elements[0].type, 'rich_text_preformatted');
  const lines = box(m).split('\n');
  assert.equal(lines.length, BOX_LINES);
  assert.deepEqual(lines.slice(0, 3), ['✓ Got ready', '› Reading the code · 4 steps', '    $ rg --files src']);
  assert.match(m.text, /^Working for <@U1> · 2m 14s\n✓ Got ready/);
});

test('older rows fold into one Earlier line, so the box keeps its height', () => {
  const rows = ['✓ Read the code · 40 steps', '✓ Upgraded next · 6 steps', '✓ Ran the build · 12 steps', '✓ Fixed 4 type errors · 18 steps', '✓ Ran the tests · 9 steps', '› Fixing a failing test · 3 steps'];
  const lines = boxLines(rows, 'npm test');
  assert.equal(lines.length, BOX_LINES);
  assert.equal(lines[0], '✓ Earlier · Read the code, Upgraded next, Ran the build · 58 steps');
  assert.deepEqual(lines.slice(1), ['✓ Fixed 4 type errors · 18 steps', '✓ Ran the tests · 9 steps', '› Fixing a failing test · 3 steps', '    $ npm test']);
});

test('with a todo list the current todo keeps its command under it, and open todos past the room become one line', () => {
  const rows = ['✓ Map the API routes', '✓ Read the database layer', '✓ Read the auth middleware', '› Rank the code smells', '○ Check each finding', '○ Write the top three', '○ Post the reply'];
  assert.deepEqual(boxLines(rows, 'rg TODO'), ['✓ Earlier · Map the API routes, Read the database layer, Read the auth middleware', '› Rank the code smells', '    $ rg TODO', '○ Check each finding', '○ 2 more']);
  assert.deepEqual(boxLines(['› First', '○ A', '○ B', '○ C', '○ D', '○ E'], 'ls'), ['› First', '    $ ls', '○ A', '○ B', '○ 3 more']);
});

test('a long command is cut to one short line', () => {
  const lines = boxLines(['› Running · 1 step'], 'x'.repeat(300));
  assert.ok(lines[1].length <= 100, lines[1]);
});

test('a status with no rows is the title alone, with no box', () => {
  const m = statusMessage({ title: 'In line for <@U1> · 2nd in line', rows: [] });
  assert.equal(m.blocks.length, 1);
  assert.equal(m.text, 'In line for <@U1> · 2nd in line');
});
