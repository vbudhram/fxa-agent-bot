import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGates, gateAllows, loadMembers, codeAllowed, sessionTeam } from '../src/access.js';

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
