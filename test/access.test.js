import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGates, gateAllows, loadMembers } from '../src/access.js';

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
