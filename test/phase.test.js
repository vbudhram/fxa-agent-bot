import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phase, stage } from '../src/render.js';

test('commands group by the kind of work', () => {
  const k = (s) => phase(s).kind;
  assert.equal(k('Running cd /home/agent/fxa/packages/fxa-settings && grep -rn "signin-button"'), 'search');
  assert.equal(k('Running cd /a && cd b && sed -n 270,276p compo'), 'read');
  assert.equal(k("Running perl -0pi -e 's/x/y/' index.tsx"), 'edit');
  assert.equal(k('Running npx jest SigninRecoveryCode --silent'), 'test');
  assert.equal(k('Running npx nx lint fxa-settings'), 'check');
  assert.equal(k('Running git log --oneline -5'), 'git');
  assert.equal(k('Reading index.tsx'), 'read');
  assert.equal(k('Searching for "recovery-key"'), 'search');
  assert.equal(k('Running node scripts/x.js'), 'shell');
});

test('the detail drops the leading cd', () => {
  assert.equal(phase('Running cd /home/agent/fxa && grep -rn x .').detail, 'grep -rn x .');
});

test('each skill is its own phase', () => {
  assert.notEqual(phase('Using /fxa-review-quick').kind, phase('Using /humanizer').kind);
});

test('stages group reading and searching, and leave misc steps in place', () => {
  const k = (x) => stage(x)?.kind ?? null;
  assert.equal(k('Reading index.tsx'), 'explore');
  assert.equal(k('Searching for "signin"'), 'explore');
  assert.equal(k('Running git log -5'), 'explore');
  assert.equal(k('Editing index.tsx'), 'edit');
  assert.equal(k('Running npx jest Signin'), 'verify');
  assert.equal(k('Using /fxa-verify'), 'verify');
  assert.equal(k('Using /fxa-review-quick'), 'review');
  assert.equal(k('Running node scripts/x.js'), null);
});

test("a subagent's own steps stay in its row, and the wrap-up's subagents review", () => {
  const k = (x) => stage(x)?.kind ?? null;
  assert.equal(k('↳ Running git diff'), null);
  assert.equal(k('↳ Editing index.tsx'), null);
  assert.equal(k('Delegating to fxa-explore: find X'), 'explore');
  assert.equal(k('Delegating to fxa-reviewer: review'), 'review');
  assert.equal(k('Delegating to fxa-writer: PR body'), 'review');
  assert.equal(k('Delegating: find X'), 'explore');
  assert.equal(phase('Delegating to fxa-explore: find X').detail, 'fxa-explore: find X');
  assert.equal(phase('Delegating: find X').detail, 'find X');
});
