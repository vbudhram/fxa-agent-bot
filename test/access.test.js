import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGates, gateAllows, loadMembers, codeAllowed, codeRefusal, NO_GROUPS_READ, START_PRIVATE, PRIVATE_ONLY, sessionTeam, maySteer, mayTap } from '../src/access.js';

test('a gated channel allows only members of its source channel', () => {
  const gates = parseGates('CPUBLIC:CPRIVATE');
  const members = new Map([['CPRIVATE', new Set(['UIN'])]]);
  assert.equal(gateAllows(gates, members, 'CPUBLIC', 'UIN'), true);
  assert.equal(gateAllows(gates, members, 'CPUBLIC', 'UOUT'), false);
});

test('an ungated channel is not changed by the gate', () => {
  const gates = parseGates('CPUBLIC:CPRIVATE');
  assert.equal(gateAllows(gates, new Map(), 'COTHER', 'UOUT'), true);
  assert.equal(gateAllows(parseGates(''), new Map(), 'CPUBLIC', 'UOUT'), true);
});

test('a gate whose members are not loaded lets nobody in', () => {
  assert.equal(gateAllows(parseGates('CPUBLIC:CPRIVATE'), new Map(), 'CPUBLIC', 'UIN'), false);
});

test('members load across pages, and a failed load keeps the last list', async () => {
  const pages = { '': { members: ['U1'], response_metadata: { next_cursor: 'p2' } }, p2: { members: ['U2'] } };
  const ok = { conversations: { members: async ({ cursor = '' }) => pages[cursor] } };
  const members = new Map();
  await loadMembers(ok, parseGates('CPUBLIC:CPRIVATE'), members);
  assert.deepEqual([...members.get('CPRIVATE')], ['U1', 'U2']);
  const down = { conversations: { members: async () => { throw new Error('ratelimited'); } } };
  await loadMembers(down, parseGates('CPUBLIC:CPRIVATE'), members);
  assert.deepEqual([...members.get('CPRIVATE')], ['U1', 'U2']);
});

test('a team with a private repo posts code only in a private channel', async () => {
  const client = (info) => ({ conversations: { info: async () => { if (info instanceof Error) throw info; return { channel: info }; } } });
  assert.equal(await codeAllowed({ private: false, channel: 'C1' }, client(new Error('missing_scope'))), true);
  assert.equal(await codeAllowed({ private: true, channel: 'C1' }, client({ is_private: true })), true);
  assert.equal(await codeAllowed({ private: true, channel: 'C1' }, client({ is_private: false })), false);
  assert.equal(await codeAllowed({ private: true, channel: 'C1' }, client(new Error('missing_scope'))), false);
});

test('a missing groups:read scope still refuses, and says why, not "start it in a private channel"', async (t) => {
  const err = (provided) => Object.assign(new Error('missing_scope'), { data: { error: 'missing_scope', needed: 'groups:read', provided } });
  const client = (e) => ({ conversations: { info: async () => { throw e; } } });
  const logged = t.mock.method(console, 'error', () => {});
  const s = { private: true, channel: 'G1' };
  assert.equal(await codeRefusal(s, client(err('chat:write,channels:read')), START_PRIVATE), NO_GROUPS_READ);
  assert.equal(await codeRefusal(s, client(err('chat:write'))), NO_GROUPS_READ);
  assert.equal(logged.mock.callCount(), 1, 'one log line for each start of the bot');
  assert.match(logged.mock.calls[0].arguments[0], /groups:read.*manifest\.yml/);
  // With groups:read, a failed lookup is a public channel (no channels:read): the usual text.
  assert.equal(await codeRefusal(s, client(err('groups:read')), START_PRIVATE), START_PRIVATE);
  assert.equal(await codeRefusal(s, client(new Error('ratelimited'))), PRIVATE_ONLY);
  assert.equal(await codeRefusal({ private: false, channel: 'C1' }, client(err('chat:write'))), null);
});

test('a pending resume or move belongs to the earlier session\'s team, not FxA', () => {
  const rec = { a1: { key: 'a1', profile: 'monitor' }, a2: { key: 'a2', resume_from: 'a1' } };
  const look = (k) => rec[k];
  assert.equal(sessionTeam({ profile: 'pyfxa-team' }, look), 'pyfxa-team');
  assert.equal(sessionTeam({ resume_from: 'a1' }, look), 'monitor');
  assert.equal(sessionTeam({ moved_from: 'a1' }, look), 'monitor');
  assert.equal(sessionTeam({ resume_from: 'a2' }, look), 'monitor', 'through a chain of resumes');
  assert.equal(sessionTeam({ resumed_profile: 'monitor' }, look), 'monitor');
  assert.equal(sessionTeam({}, look), 'fxa');
});

test('a live-session reply steers only a person the channel still allows, owner included', () => {
  // maySteer(owner, user, allowedHere, steerAnyone, onTeam)
  assert.equal(maySteer('U1', 'U1', true, false, false), true, 'the owner, still allowed');
  assert.equal(maySteer('U1', 'U1', false, false, false), false, 'the owner, removed from the gate or the user list');
  assert.equal(maySteer('U1', 'U2', true, true, true), true, 'a teammate when anyone on the team may steer');
  assert.equal(maySteer('U1', 'U2', true, false, true), false, 'a teammate when only the owner may steer');
  assert.equal(maySteer('U1', 'U2', false, true, true), false, 'a teammate the channel does not allow');
});

test('a teammate may tap the PR buttons, but not the desktop, the diff or Stop', () => {
  // mayTap(action, owner, user, allowedHere, steerAnyone, onTeam)
  assert.equal(mayTap('open_pr', 'U1', 'U2', true, true, true), true, 'Open PR, a teammate');
  assert.equal(mayTap('pr_ready', 'U1', 'U2', true, true, true), true, 'Mark ready, a teammate');
  assert.equal(mayTap('open_pr', 'U1', 'U2', true, false, true), false, 'Open PR, a teammate under STEER=owner');
  assert.equal(mayTap('open_pr', 'U1', 'U2', true, true, false), false, 'Open PR, not on the team');
  assert.equal(mayTap('desktop', 'U1', 'U2', true, true, true), false, 'the desktop, a teammate');
  assert.equal(mayTap('stop', 'U1', 'U1', true, true, true), true, 'Stop, the owner');
});

test('a team admin takes over every control, and a PR list limits Open PR and Push', () => {
  // mayTap(action, owner, user, allowedHere, steerAnyone, onTeam, admin, prOk)
  assert.equal(mayTap('stop', 'U1', 'UADM', true, true, true, true), true, 'Stop, a team admin');
  assert.equal(mayTap('desktop', 'U1', 'UADM', true, false, false, true), true, 'the desktop, a team admin under STEER=owner');
  assert.equal(mayTap('stop', 'U1', 'UADM', false, true, true, true), false, 'a team admin the channel does not allow');
  assert.equal(maySteer('U1', 'UADM', true, false, false, true), true, 'a team admin steers under STEER=owner');
  assert.equal(mayTap('open_pr', 'U1', 'U2', true, true, true, false, false), false, 'Open PR, a teammate not on the PR list');
  assert.equal(mayTap('push_branch', 'U1', 'U1', true, true, true, false, false), false, 'Push, the owner not on the PR list');
  assert.equal(mayTap('pr_ready', 'U1', 'U2', true, true, true, false, false), true, 'Mark ready is not on the PR list rule');
  assert.equal(mayTap('open_pr', 'U1', 'U2', true, true, true, false, true), true, 'Open PR, a teammate on the PR list');
});
