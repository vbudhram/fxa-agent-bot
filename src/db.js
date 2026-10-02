// The controller's SQLite store, for the bot. fxa-sandbox-ctl owns the schema
// (`fxa-sandbox-ctl db init`); this only connects. Bind every value with ?.
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';

export function openDb(path = process.env.FXA_DB || `${process.env.HOME}/.claude/state/fxa.db`, { readOnly = false } = {}) {
  const db = new DatabaseSync(path, { readOnly });
  db.exec('PRAGMA busy_timeout = 5000');   // wait for a writer, as every other client does
  return db;
}

// One log record into the store, mapped by its ingest triggers. Never throws: the
// caller's file is the fallback while the store proves itself.
let shared = null;
export function ingest(tbl, obj) {
  try {
    if (!shared) {
      const path = process.env.FXA_DB || `${process.env.HOME}/.claude/state/fxa.db`;
      if (!existsSync(path)) return;   // no store here: a test, or a host without db init
      shared = openDb(path);
    }
    shared.prepare('INSERT INTO ingest (tbl, j) VALUES (?, ?)').run(tbl, typeof obj === 'string' ? obj : JSON.stringify(obj));
  } catch { shared = null; }
}
