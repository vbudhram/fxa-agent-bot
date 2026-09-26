import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phase } from '../src/render.js';

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
