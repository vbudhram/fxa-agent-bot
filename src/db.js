// The controller's SQLite store, for the bot. fxa-sandbox-ctl owns the schema
// (`fxa-sandbox-ctl db init`); this only connects. Bind every value with ?.
import { DatabaseSync } from 'node:sqlite';

export function openDb(path = process.env.FXA_DB || `${process.env.HOME}/.claude/state/fxa.db`, { readOnly = false } = {}) {
  const db = new DatabaseSync(path, { readOnly });
  db.exec('PRAGMA busy_timeout = 5000');   // wait for a writer, as every other client does
  return db;
}
