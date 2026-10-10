import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProfile } from '../src/profile.js';

const env = { PROFILE_USERS: 'monitor:UMON+UBOTH', PROFILE_JIRA: 'MNTOR:monitor', PROFILE_CHANNELS: 'CMON:monitor' };
const r = (text, channel = 'CFXA', user = 'UMON') => resolveProfile({ text, channel, user, env });

test('the flag picks the profile and leaves the request', () => {
  assert.deepEqual(r('profile:monitor explain sign-in'), { profile: 'monitor', text: 'explain sign-in' });
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
  const env = { PROFILE_OPEN: 'pyfxa-team', PROFILE_USERS: 'monitor:U1' };
  assert.equal(resolveProfile({ text: 'profile:pyfxa-team fix it', user: 'U9', env }).profile, 'pyfxa-team');
  assert.match(resolveProfile({ text: 'profile:monitor fix it', user: 'U9', env }).error, /can't start/);
});

test('a profile: word inside the text is not a flag (a pasted scope list)', () => {
  assert.deepEqual(r('why did the client lose avatar? log: scope=openid profile:email profile:avatar'),
    { profile: undefined, text: 'why did the client lose avatar? log: scope=openid profile:email profile:avatar' });
});
