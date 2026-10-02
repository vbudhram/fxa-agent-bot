import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.js';

test('the bot reads and writes the store with bound values', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'fxadb-')), 'fxa.db');
  const db = openDb(path);
  db.exec('CREATE TABLE t (v TEXT)');
  db.prepare('INSERT INTO t VALUES (?)').run("it's'; DROP TABLE t; --");
  assert.equal(db.prepare('SELECT v FROM t').get().v, "it's'; DROP TABLE t; --");
  assert.throws(() => openDb(path, { readOnly: true }).exec('DELETE FROM t'), /readonly/i);
});
