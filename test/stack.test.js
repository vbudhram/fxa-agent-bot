import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStack, teamAlias, stackHelp, STACK_ADD, stackRepos, teamsFor, pickerRefusal, stackTeamCard, stackRepoCard, treeRows, valueRepo, prView, prPatch, followTargets, carryPrs } from '../src/stack.js';

test('parseStack: pick, a team, a checkout, a bad link', () => {
  assert.deepEqual(parseStack('!stack'), { sub: 'pick' });
  assert.deepEqual(parseStack('!stack monitor --codex repos=a,b fix it'), { sub: 'start', team: 'monitor', repos: ['a', 'b'], task: '--codex fix it' }, 'a flag before repos= keeps both');
  assert.deepEqual(parseStack('!stack monitor --codex fix it'), { sub: 'start', team: 'monitor', repos: undefined, task: '--codex fix it' });
  assert.deepEqual(parseStack('!stack monitor --codex'), { sub: 'pick', team: 'monitor' }, 'a flag alone is no task');
  assert.match(parseStack('!stack monitor --codex repos=a').error ?? '', /Add the task after the repos/, 'a flag and repos with no task say to add the task');
  assert.match(parseStack('!stack monitor repos=a --codex').error ?? '', /Add the task after the repos/, 'so does a flag after the repos');
  assert.deepEqual(parseStack('!stack monitor repos=a --codex fix it'), { sub: 'start', team: 'monitor', repos: ['a'], task: '--codex fix it' });
  assert.deepEqual(parseStack('!stack PyFxA-Team'), { sub: 'pick', team: 'pyfxa-team' });
  assert.deepEqual(parseStack('!stack checkout <https://github.com/mozilla/PyFxA/pull/12|PyFxA#12>'),
    { sub: 'checkout', url: 'https://github.com/mozilla/PyFxA/pull/12', slug: 'mozilla/PyFxA' });
  assert.match(parseStack('!stack checkout https://example.com/x').error, /GitHub PR link/);
  assert.deepEqual(parseStack('!stack add mozilla/PyFxA'), { sub: 'add', error: STACK_ADD });
  // !team is the same command: each form parses as its !stack twin.
  for (const t of ['!team', '!TEAM monitor', '!team pyfxa-team repos=PyFxA fix it', '!team checkout https://github.com/mozilla/fxa/pull/7'])
    assert.deepEqual(parseStack(teamAlias(t)), parseStack(t.replace(/^!team/i, '!stack')));
  assert.equal(teamAlias('!teammate hi'), '!teammate hi');
  assert.deepEqual(parseStack('!stack Help'), { sub: 'help' });
});

test('parseStack: a team and a task start at once, with the named repos or the defaults', () => {
  assert.deepEqual(parseStack('!stack pyfxa-team make the tests read env'), { sub: 'start', team: 'pyfxa-team', repos: undefined, task: 'make the tests read env' });
  assert.deepEqual(parseStack('!stack pyfxa-team repos=PyFxA,mozilla/fxa fix\nthe build'), { sub: 'start', team: 'pyfxa-team', repos: ['PyFxA', 'mozilla/fxa'], task: 'fix\nthe build' });
  assert.match(parseStack('!stack fxa repos=fxa').error, /Add the task after the repos/);
});

test('stackRepos: a slug or a name, any case, from the team\'s work repos; else which one is wrong', () => {
  const team = { profile: 'pyfxa-team', defaults: ['mozilla/PyFxA'], repos: [{ slug: 'mozilla/fxa', role: 'work' }, { slug: 'mozilla/PyFxA', role: 'work' }, { slug: 'mozilla/docs', role: 'read' }] };
  assert.deepEqual(stackRepos(team), { repos: ['mozilla/PyFxA'] });
  assert.deepEqual(stackRepos(team, ['pyfxa', 'mozilla/FXA', 'PyFxA']), { repos: ['mozilla/PyFxA', 'mozilla/fxa'] });
  assert.match(stackRepos(team, ['docs']).error, /`docs` is not one of pyfxa-team's repos: `mozilla\/fxa`, `mozilla\/PyFxA`/);
});

test('teamsFor: fxa and open teams for all, gated ones only for their people', () => {
  const p = [{ profile: 'fxa' }, { profile: 'pyfxa-team' }, { profile: 'monitor' }];
  const env = { PROFILE_OPEN: 'pyfxa-team', PROFILE_USERS: 'monitor:U1+U2' };
  assert.deepEqual(teamsFor(p, 'U9', env).map((t) => t.profile), ['fxa', 'pyfxa-team']);
  assert.deepEqual(teamsFor(p, 'U2', env).map((t) => t.profile), ['fxa', 'pyfxa-team', 'monitor']);
});

test('stackTeamCard and stackRepoCard: the team list, then work repos with defaults ticked', () => {
  const t = stackTeamCard([{ profile: 'fxa', label: 'fxa' }, { profile: 'pyfxa-team', label: 'PyFxA team' }]);
  assert.deepEqual(t.blocks[0].accessory.options.map((o) => o.value), ['fxa', 'pyfxa-team']);
  const team = { profile: 'pyfxa-team', label: 'PyFxA team', defaults: ['mozilla/PyFxA', 'mozilla/fxa'],
    repos: [{ slug: 'mozilla/PyFxA', role: 'work', write: false }, { slug: 'mozilla/fxa', role: 'work', write: true }, { slug: 'x/dep', role: 'dep', write: false }] };
  const r = stackRepoCard(team);
  const sel = r.blocks[0].accessory;
  assert.deepEqual(sel.options.map((o) => o.text.text), ['mozilla/PyFxA (diff)', 'mozilla/fxa']);
  assert.deepEqual(sel.initial_options.map((o) => o.value), ['mozilla/PyFxA', 'mozilla/fxa']);
  assert.equal(r.blocks[1].elements[0].value, 'pyfxa-team');
  assert.deepEqual(stackRepoCard(team, ['mozilla/fxa']).blocks[0].accessory.initial_options.map((o) => o.value), ['mozilla/fxa']);
});

test('treeRows: one row for each changed repo; PR buttons only where it ships a PR', () => {
  const rows = treeRows('agent-1', [
    { name: 'fxa', slug: 'mozilla/fxa', out: 'pr', changes: 2, pr: null },
    { name: 'pyfxa', slug: 'mozilla/PyFxA', out: 'diff', changes: 1 },
    { name: 'idle', slug: 'mozilla/idle', out: 'pr', changes: 0 },
  ]);
  assert.deepEqual(rows.map((r) => r.elements.map((b) => `${b.action_id}:${b.value}`)), [
    ['diff:agent-1|mozilla/fxa', 'open_pr:agent-1|mozilla/fxa', 'push_branch:agent-1|mozilla/fxa'],
    ['diff:agent-1|mozilla/PyFxA'],
  ]);
  assert.deepEqual(treeRows('k', [{ name: 'fxa', slug: 'mozilla/fxa', out: 'pr', changes: 1, pr: 'u' }])[0].elements.map((b) => b.text.text), ['Diff · fxa', 'Update PR · fxa']);
  assert.equal(treeRows('k', [{ name: 'fxa', slug: 'mozilla/fxa', out: 'pr', changes: 1 }], { readOnly: true })[0].elements.length, 1);
});

test('valueRepo: the repo after the key, or after the login', () => {
  assert.equal(valueRepo('agent-1|mozilla/fxa'), 'mozilla/fxa');
  assert.equal(valueRepo('agent-1|copilot|mozilla/PyFxA'), 'mozilla/PyFxA');
  assert.equal(valueRepo('agent-1|copilot'), null);
  assert.equal(valueRepo('agent-1'), null);
});

test('prView and prPatch: a stack reads and writes one repo PR state; a plain session is untouched', () => {
  const s = { key: 'k', state: 'active', pr_url: 'top', prs: { 'mozilla/fxa': { pr_url: 'u1', pr_card_ts: '1.1' } } };
  const v = prView(s, 'mozilla/fxa');
  assert.equal(v.pr_url, 'u1'); assert.equal(v.pr_card_ts, '1.1'); assert.equal(v.state, 'active'); assert.equal(v.repo, 'mozilla/fxa');
  assert.equal(prView(s, 'mozilla/PyFxA').pr_url, undefined);
  assert.equal(prView(s, null), s);
  assert.deepEqual(prPatch(s, 'mozilla/PyFxA', { pr_url: 'u2', then_wrap: 'pr' }),
    { then_wrap: 'pr', prs: { 'mozilla/fxa': { pr_url: 'u1', pr_card_ts: '1.1' }, 'mozilla/PyFxA': { pr_url: 'u2' } } });
  assert.deepEqual(prPatch(s, null, { pr_url: 'x' }), { pr_url: 'x' });
});

test('followTargets and carryPrs: each repo PR; a move leaves the cards behind', () => {
  assert.deepEqual(followTargets({ key: 'k', pr_url: 'u' }).map((t) => t.pr_url), ['u']);
  assert.deepEqual(followTargets({ key: 'k', prs: { a: { pr_url: 'u1' }, b: { pr_url: 'u2' } } }).map((t) => `${t.repo}:${t.pr_url}`), ['a:u1', 'b:u2']);
  assert.deepEqual(carryPrs({ a: { pr_url: 'u', pr_card_ts: '1' } }, true), { a: { pr_url: 'u', pr_card_ts: null, pr_card_head: null, pr_card_text: null } });
  assert.deepEqual(carryPrs({ a: { pr_card_ts: '1' } }, false), { a: { pr_card_ts: '1' } });
});

test('stackHelp: the commands and the person\'s teams', () => {
  const t = stackHelp([{ profile: 'fxa' }, { profile: 'pyfxa-team' }]);
  assert.match(t, /!team checkout <PR link>/);
  assert.match(t, /`!stack` works too/);
  assert.match(t, /Your teams: `fxa`, `pyfxa-team`\./);
});

test('pickerRefusal: anyone may use an open picker, but not over someone else\'s session or for a team they are not on', () => {
  const env = { PROFILE_USERS: 'monitor:U1' };
  assert.equal(pickerRefusal({ user: 'U2', profile: 'fxa', env }), null, 'a second person in the thread may pick');
  assert.equal(pickerRefusal({ user: 'U1', profile: 'monitor', env }), null);
  assert.match(pickerRefusal({ user: 'U2', profile: 'monitor', label: 'Monitor Team', env }), /You are not on Monitor Team/);
  const cur = { owner: 'U1', state: 'paused' };
  assert.match(pickerRefusal({ user: 'U2', cur, env }), /<@U1>'s session/);
  assert.equal(pickerRefusal({ user: 'U1', cur, env }), null, 'the owner may pick again');
  assert.equal(pickerRefusal({ user: 'U2', cur: { ...cur, pr_seen: { state: 'MERGED' } }, env }), null, 'a merged PR frees the thread');
});
