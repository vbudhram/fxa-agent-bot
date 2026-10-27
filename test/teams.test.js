import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { teamIndex, teamChannels } from '../src/teams.js';
import { mayStart, resolveProfile } from '../src/profile.js';
import { teamsFor } from '../src/stack.js';

const dir = mkdtempSync(join(tmpdir(), 'teams-test-'));
const file = join(dir, 'index.json');
const env = { FXA_TEAMS_INDEX: file, PROFILE_OPEN: '', PROFILE_USERS: '', PROFILE_JIRA: 'MNTOR:monitor', PROFILE_CHANNELS: '' };
let tick = 1;
// Each write gets a later mtime, as a real rewrite would, so the reader sees the change.
const write = (teams) => { writeFileSync(file, typeof teams === 'string' ? teams : JSON.stringify({ schema: 1, teams })); utimesSync(file, tick, tick); tick += 1; };
const rusty = (over = {}) => ({ label: 'Rusty', status: 'active', jira: 'RUST', access: { open: false, users: ['U0RUSTY1'], channels: ['C0RUSTY1'], jira_prefixes: ['RS'] }, ...over });

test('an active record lets its users start it, and nobody else', () => {
  write({ rusty: rusty() });
  assert.equal(mayStart('rusty', 'U0RUSTY1', env), true);
  assert.equal(mayStart('rusty', 'U0OTHER1', env), false);
});

test('an open record lets anyone start it; a draft or disabled one lets nobody', () => {
  write({ rusty: rusty({ access: { open: true } }) });
  assert.equal(mayStart('rusty', 'U0OTHER1', env), true);
  write({ rusty: rusty({ status: 'disabled' }) });
  assert.equal(mayStart('rusty', 'U0RUSTY1', env), false);
  write({ rusty: rusty({ status: 'draft', access: { open: true } }) });
  assert.equal(mayStart('rusty', 'U0OTHER1', env), false);
});

test('a record decides alone: an old PROFILE_OPEN or PROFILE_USERS entry does not reopen it', () => {
  const old = { ...env, PROFILE_OPEN: 'rusty', PROFILE_USERS: 'rusty:U0OTHER1' };
  write({ rusty: rusty({ status: 'disabled' }) });
  assert.equal(mayStart('rusty', 'U0OTHER1', old), false, 'a disabled record stays shut');
  write({ rusty: rusty() });
  assert.equal(mayStart('rusty', 'U0OTHER1', old), false, 'a gated record admits only its users');
  assert.equal(mayStart('rusty', 'U0RUSTY1', old), true);
  assert.equal(mayStart('norecord', 'U0OTHER1', { ...old, PROFILE_OPEN: 'norecord' }), true, 'a team with no record still opens through the env');
  assert.equal(mayStart('norecord', 'U0OTHER1', { ...old, PROFILE_USERS: 'norecord:U0OTHER1' }), true);
});

test('a change to the index is read with no restart', () => {
  write({ rusty: rusty() });
  assert.equal(mayStart('rusty', 'U0NEW001', env), false);
  write({ rusty: rusty({ access: { users: ['U0RUSTY1', 'U0NEW001'] } }) });
  assert.equal(mayStart('rusty', 'U0NEW001', env), true);
  write({ rusty: rusty({ access: { users: ['U0RUSTY1'] } }) });
  assert.equal(mayStart('rusty', 'U0NEW001', env), false);
});

test('a bad index keeps the last good copy; no index opens no record team', () => {
  write({ rusty: rusty() });
  write('{ not json');
  assert.equal(mayStart('rusty', 'U0RUSTY1', env), true);
  rmSync(file);
  assert.equal(mayStart('rusty', 'U0RUSTY1', env), false);
  assert.deepEqual(teamIndex(env), {});
});

test('IDs that are not Slack or Jira IDs are dropped', () => {
  write({ rusty: rusty({ access: { users: ['U0RUSTY1', 'bob', '*'], channels: ['C0RUSTY1', '#general'], jira_prefixes: ['RS', 'bad-1'] } }), 'Bad Name': rusty() });
  const t = teamIndex(env);
  assert.deepEqual(Object.keys(t), ['rusty']);
  assert.deepEqual([t.rusty.users, t.rusty.channels, t.rusty.prefixes], [['U0RUSTY1'], ['C0RUSTY1'], ['RS', 'RUST']]);
});

test("a record's channel and Jira keys route to it; the env's own rules win", () => {
  write({ rusty: rusty(), clash: rusty({ jira: 'MNTOR', access: { users: ['U0RUSTY1'], channels: [], jira_prefixes: [] } }) });
  assert.equal(resolveProfile({ text: 'look at this', channel: 'C0RUSTY1', user: 'U0RUSTY1', env }).profile, 'rusty');
  assert.equal(resolveProfile({ text: 'fix RUST-12', channel: 'COTHER', user: 'U0RUSTY1', env }).profile, 'rusty');
  assert.equal(resolveProfile({ text: 'fix RS-3', channel: 'COTHER', user: 'U0RUSTY1', env }).profile, 'rusty');
  // MNTOR is the env's (PROFILE_JIRA): it routes to monitor, not to the record that also names it.
  assert.match(resolveProfile({ text: 'fix MNTOR-1', channel: 'COTHER', user: 'U0RUSTY1', env }).error, /monitor/);
  assert.match(resolveProfile({ text: 'hi', channel: 'C0RUSTY1', user: 'U0OTHER1', env }).error, /rusty/);
});

test('the !team picker offers a record team to its users only', () => {
  write({ rusty: rusty() });
  const p = [{ profile: 'fxa' }, { profile: 'rusty' }];
  assert.deepEqual(teamsFor(p, 'U0RUSTY1', env).map((t) => t.profile), ['fxa', 'rusty']);
  assert.deepEqual(teamsFor(p, 'U0OTHER1', env).map((t) => t.profile), ['fxa']);
});

test("only active teams' channels count as allowed channels", () => {
  write({ rusty: rusty(), off: rusty({ status: 'disabled', access: { channels: ['C0OFF001'] } }) });
  assert.deepEqual(teamChannels(env), ['C0RUSTY1']);
});

test('a record team carries its admins and PR users to isAdmin and mayOpenPr', async () => {
  const { isAdmin, mayOpenPr } = await import('../src/profile.js');
  write({ ex: { label: 'Ex', status: 'active', access: { open: true }, admins: ['U0ADMIN1'], pr_users: ['U0PRUSE1', 'nope'] } });
  assert.equal(isAdmin('ex', 'U0ADMIN1', env), true);
  assert.deepEqual(['U0PRUSE1', 'U0ADMIN1', 'U0OTHER1', 'nope'].map((u) => mayOpenPr('ex', u, env)), [true, true, false, false]);
});
