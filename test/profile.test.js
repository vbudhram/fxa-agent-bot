import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProfile } from '../src/profile.js';

const env = { FXA_TEAMS_INDEX: '/nonexistent/index.json', PROFILE_USERS: 'monitor:UMON+UBOTH', PROFILE_JIRA: 'MNTOR:monitor', PROFILE_CHANNELS: 'CMON:monitor' };
const r = (text, channel = 'CFXA', user = 'UMON') => resolveProfile({ text, channel, user, env });

test('the flag picks the profile and leaves the request', () => {
  assert.deepEqual(r('profile:monitor explain sign-in'), { profile: 'monitor', text: 'explain sign-in' });
});

test('team: works as the flag too, the name the !team picker uses', () => {
  assert.deepEqual(r('team:monitor explain sign-in'), { profile: 'monitor', text: 'explain sign-in' });
});

test('a Jira key maps by prefix, then the channel, then the default', () => {
  assert.equal(r('look at MNTOR-5384').profile, 'monitor');
  assert.equal(r('explain sign-in', 'CMON').profile, 'monitor');
  assert.deepEqual(r('fix FXA-123'), { profile: undefined, text: 'fix FXA-123' });
});

test('the flag wins over the key and the channel', () => {
  assert.equal(r('profile:fxa look at MNTOR-5384', 'CMON').profile, 'fxa');
});

test('a person not listed for a profile is refused, not sent to FxA', () => {
  assert.match(r('profile:monitor hi', 'CFXA', 'UOTHER').error, /monitor/);
  assert.match(r('look at MNTOR-1', 'CFXA', 'UOTHER').error, /monitor/);
  assert.match(r('hi', 'CMON', 'UOTHER').error, /monitor/);
});

test('fxa needs no listing, and a bad name is refused', () => {
  assert.equal(r('profile:fxa hi', 'CFXA', 'UOTHER').profile, 'fxa');
  assert.match(r('profile:../x hi').error, /profile/);
});

test('PROFILE_OPEN: an open team needs no PROFILE_USERS entry', () => {
  const env = { FXA_TEAMS_INDEX: '/nonexistent/index.json', PROFILE_OPEN: 'pyfxa-team', PROFILE_USERS: 'monitor:U1' };
  assert.equal(resolveProfile({ text: 'profile:pyfxa-team fix it', user: 'U9', env }).profile, 'pyfxa-team');
  assert.match(resolveProfile({ text: 'profile:monitor fix it', user: 'U9', env }).error, /can't start/);
});

test('a refused profile keeps the text, for a !stack pick that overrides it', () => {
  const r2 = resolveProfile({ text: 'MNTOR-12 fix it', channel: 'C1', user: 'U9', env: { PROFILE_JIRA: 'MNTOR:monitor' } });
  assert.match(r2.error, /can't start/);
  assert.equal(r2.text, 'MNTOR-12 fix it');
});

test('a profile: word inside the text is not a flag (a pasted scope list)', () => {
  assert.deepEqual(r('why did the client lose avatar? log: scope=openid profile:email profile:avatar'),
    { profile: undefined, text: 'why did the client lose avatar? log: scope=openid profile:email profile:avatar' });
});

test('a team that takes secret tickets does not claim its Jira project as a prefix: an FXA key still starts an FxA session', async () => {
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'secret-team-'));
  const index = join(dir, 'index.json');
  writeFileSync(index, JSON.stringify({ schema: 1, teams: { 'fxa-private': { label: 'FxA Private', status: 'active', jira: 'FXA', secret: true, access: { users: ['U0SECRET1'] } },
    rusty: { status: 'active', jira: 'RUST', access: { users: ['U0SECRET1'] } } } }));
  const env = { FXA_TEAMS_INDEX: index };
  const other = resolveProfile({ text: 'fix FXA-12345 please', channel: 'C0PUBLIC1', user: 'U0OTHER01', env });
  assert.equal(other.error, undefined);
  assert.notEqual(other.profile, 'fxa-private');
  assert.notEqual(resolveProfile({ text: 'fix FXA-1', channel: 'C0PUBLIC1', user: 'U0SECRET1', env }).profile, 'fxa-private');
  assert.equal(resolveProfile({ text: 'fix RUST-1', channel: 'C0PUBLIC1', user: 'U0SECRET1', env }).profile, 'rusty');
  assert.equal(resolveProfile({ text: 'team:fxa-private fix it', channel: 'C0PUBLIC1', user: 'U0SECRET1', env }).profile, 'fxa-private');
});

test('PROFILE_ADMINS and PROFILE_PR_USERS: an admin opens PRs; with no list anyone may; bad IDs are dropped', async () => {
  const { isAdmin, mayOpenPr } = await import('../src/profile.js');
  const e = { FXA_TEAMS_INDEX: '/nonexistent/index.json', PROFILE_ADMINS: 'fxa:U0ADMIN1+bad', PROFILE_PR_USERS: 'fxa:U0PRUSE1' };
  assert.equal(isAdmin('fxa', 'U0ADMIN1', e), true);
  assert.equal(isAdmin('fxa', 'bad', e), false);
  assert.deepEqual(['U0PRUSE1', 'U0ADMIN1', 'U0OTHER1'].map((u) => mayOpenPr('fxa', u, e)), [true, true, false]);
  assert.equal(mayOpenPr('monitor', 'U0OTHER1', e), true, 'a team with no PR list');
});
