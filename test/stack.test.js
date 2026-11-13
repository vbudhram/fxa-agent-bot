import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStack, teamAlias, stackHelp, STACK_ADD, stackRepos, teamsFor, pickerRefusal, stackTeamCard, stackRepoCard, treeRows, valueRepo, prView, prPatch, followTargets, carryPrs,
  shipRepos, afterShip, shipAsk, treeFor, namedRepos, shipHint, targetSwitch, otherOpen, targetsText } from '../src/stack.js';

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
  const env = { FXA_TEAMS_INDEX: '/nonexistent/index.json', PROFILE_OPEN: 'pyfxa-team', PROFILE_USERS: 'monitor:U1+U2' };
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

test('treeRows: 2 or more PRs get one Open N PRs, one Diff, and each repo\'s buttons in a More menu', () => {
  const trees = [
    { name: 'fxa', slug: 'mozilla/fxa', out: 'pr', changes: 2 },
    { name: 'ecosystem-platform', slug: 'mozilla/ecosystem-platform', out: 'pr', changes: 1 },
    { name: 'pyfxa', slug: 'mozilla/PyFxA', out: 'diff', changes: 1 },
  ];
  const rows = treeRows('agent-1', trees);
  assert.equal(rows.length, 1);
  const [open, diff, more] = rows[0].elements;
  assert.deepEqual([open.text.text, open.action_id, open.value, open.style], ['Open 2 PRs', 'open_prs', 'agent-1', 'primary']);
  assert.deepEqual([diff.text.text, diff.action_id, diff.value], ['Diff', 'diff', 'agent-1']);
  assert.equal(more.type, 'static_select');
  assert.deepEqual(more.options.map((o) => `${o.text.text}=${o.value}`), [
    'Diff · fxa=diff agent-1|mozilla/fxa', 'Open PR · fxa=open_pr agent-1|mozilla/fxa', 'Push · fxa=push_branch agent-1|mozilla/fxa',
    'Diff · ecosystem-platform=diff agent-1|mozilla/ecosystem-platform', 'Open PR · ecosystem-platform=open_pr agent-1|mozilla/ecosystem-platform',
    'Push · ecosystem-platform=push_branch agent-1|mozilla/ecosystem-platform', 'Diff · pyfxa=diff agent-1|mozilla/PyFxA']);
  // The menu's values keep the "<key>|<slug>" of the old buttons after the action.
  assert.equal(valueRepo(more.options[1].value.split(' ')[1]), 'mozilla/fxa');
  assert.equal(treeRows('k', trees.map((t) => ({ ...t, pr: 'u' })))[0].elements[0].text.text, 'Update 2 PRs');
  // One PR to ship (the other is a diff, or read-only): the rows of today.
  assert.equal(treeRows('k', [trees[0], trees[2]]).length, 2);
  assert.equal(treeRows('k', trees, { readOnly: true }).length, 3);
  assert.deepEqual(shipRepos(trees), ['mozilla/fxa', 'mozilla/ecosystem-platform']);
});

test('afterShip: one repo loses its own ship controls and Open N PRs; a ship of all takes every button', () => {
  const row = treeRows('agent-1', [{ name: 'fxa', slug: 'mozilla/fxa', out: 'pr', changes: 2 }, { name: 'docs', slug: 'mozilla/docs', out: 'pr', changes: 1 }]);
  const blocks = [{ type: 'markdown', text: 'Done.' }, ...row];
  const one = afterShip(blocks, 'mozilla/fxa');
  assert.deepEqual(one[1].elements.map((e) => e.action_id), ['diff', 'tree_more']);
  assert.deepEqual(one[1].elements[1].options.map((o) => o.value), ['diff agent-1|mozilla/fxa', 'diff agent-1|mozilla/docs', 'open_pr agent-1|mozilla/docs', 'push_branch agent-1|mozilla/docs']);
  assert.deepEqual(afterShip(blocks, ['mozilla/fxa', 'mozilla/docs']), [blocks[0]]);
  assert.deepEqual(afterShip(blocks, undefined), [blocks[0]]);
  // The old per-repo rows: only that repo's Open PR and Push go.
  const old = treeRows('k', [{ name: 'fxa', slug: 'mozilla/fxa', out: 'pr', changes: 2 }, { name: 'py', slug: 'mozilla/py', out: 'diff', changes: 1 }]);
  assert.deepEqual(afterShip(old, 'mozilla/fxa').map((r) => r.elements.map((e) => e.action_id)), [['diff'], ['diff']]);
});

test('shipAsk: a short ship phrase is the Open PR tap; a longer message that only has the words is not', () => {
  for (const t of ['open pr', 'Open PR', 'open the PRs', 'open both PRs', 'open prs please', 'ship it', 'Ship it!', 'yes, open the PR', 'go ahead and open the PRs', 'OPEN PULL REQUESTS'])
    assert.deepEqual(shipAsk(t), { repo: null }, t);
  assert.deepEqual(shipAsk('open PR for docs'), { repo: 'docs' });
  assert.deepEqual(shipAsk('Open the PR for ecosystem-platform, please'), { repo: 'ecosystem-platform' });
  // A question for the PR is the same ask: the link when there is one, else Open PR.
  for (const t of ['where is the PR?', "Where's the PR", 'ok where is my PR', 'make a PR', 'is there a PR?'])
    assert.deepEqual(shipAsk(t), { repo: null, ...(/make/.test(t) ? {} : { where: true }) }, t);
  assert.deepEqual(shipAsk('where is the PR for docs?'), { repo: 'docs', where: true });
  for (const t of ['where is the PR description?', 'where is the bug?']) assert.equal(shipAsk(t), null, t);
  for (const t of ["don't open a PR yet", 'why did you open pr 3?', 'open pr 3', 'open the pr and fix the test', 'what about the PR?', 'did you open a PR?', 'open', '', `open pr ${'x'.repeat(60)}`])
    assert.equal(shipAsk(t), null, t);
});

test('treeFor: a tree by name, slug or alias, any case', () => {
  const trees = [{ name: 'fxa', slug: 'mozilla/fxa' }, { name: 'ecosystem-platform', slug: 'mozilla/ecosystem-platform' }];
  const aliases = { 'mozilla/ecosystem-platform': ['docs'] };
  assert.equal(treeFor(trees, 'FXA'), 'mozilla/fxa');
  assert.equal(treeFor(trees, 'mozilla/Ecosystem-Platform'), 'mozilla/ecosystem-platform');
  assert.equal(treeFor(trees, 'Docs', aliases), 'mozilla/ecosystem-platform');
  assert.equal(treeFor(trees, 'docs'), null);
});

test('namedRepos: a plain tag adds each work repo the task names to the defaults', () => {
  const team = { profile: 'fxa', defaults: [], repos: [{ slug: 'mozilla/fxa', role: 'work' }, { slug: 'mozilla/ecosystem-platform', role: 'work', aliases: ['docs', 'documentation'] }, { slug: 'mozilla/other', role: 'dep' }] };
  assert.deepEqual(namedRepos(team, 'Fix the text in fxa-auth-server, then update ecosystem-platform'), ['mozilla/fxa', 'mozilla/ecosystem-platform']);
  assert.deepEqual(namedRepos(team, 'see mozilla/Ecosystem-Platform'), ['mozilla/fxa', 'mozilla/ecosystem-platform']);
  assert.deepEqual(namedRepos(team, 'and update the Docs.'), ['mozilla/fxa', 'mozilla/ecosystem-platform']);
  // A whole word only: fxa-auth-server is not the fxa repo, docstring is not docs, and a dep never joins.
  assert.equal(namedRepos(team, 'fix fxa-auth-server and its docstring, and mozilla/other'), null);
  assert.equal(namedRepos({ ...team, defaults: ['mozilla/fxa', 'mozilla/ecosystem-platform'] }, 'update the docs'), null);
  assert.equal(namedRepos({ repos: [{ slug: 'mozilla/fxa', role: 'work' }] }, 'fxa docs'), null);
});

test('valueRepo: the repo after the key, or after the login', () => {
  assert.equal(valueRepo('agent-1|mozilla/fxa'), 'mozilla/fxa');
  assert.equal(valueRepo('agent-1|copilot|mozilla/PyFxA'), 'mozilla/PyFxA');
  assert.equal(valueRepo('agent-1|copilot'), null);
  assert.equal(valueRepo('agent-1'), null);
});

test('prCardFor: a PR event edits the card of the same PR; another PR, or none yet, posts one', async () => {
  const { prCardFor } = await import('../src/stack.js');
  const u = 'https://github.com/mozilla/fxa/pull/1';
  assert.equal(prCardFor({ pr_card_ts: '5.0', pr_url: u }, u), '5.0');
  assert.equal(prCardFor({ pr_card_ts: '5.0', pr_url: u }, 'https://github.com/mozilla/fxa/pull/2'), null);
  assert.equal(prCardFor({ pr_url: u }, u), null);
  // A stack repo's view has its own card.
  assert.equal(prCardFor(prView({ prs: { 'mozilla/docs': { pr_card_ts: '7.0', pr_url: u } } }, 'mozilla/docs'), u), '7.0');
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
  const env = { FXA_TEAMS_INDEX: '/nonexistent/index.json', PROFILE_USERS: 'monitor:U1' };
  assert.equal(pickerRefusal({ user: 'U2', profile: 'fxa', env }), null, 'a second person in the thread may pick');
  assert.equal(pickerRefusal({ user: 'U1', profile: 'monitor', env }), null);
  assert.match(pickerRefusal({ user: 'U2', profile: 'monitor', label: 'Monitor Team', env }), /You are not on Monitor Team/);
  const cur = { owner: 'U1', state: 'paused' };
  assert.match(pickerRefusal({ user: 'U2', cur, env }), /<@U1>'s session/);
  assert.equal(pickerRefusal({ user: 'U1', cur, env }), null, 'the owner may pick again');
  assert.equal(pickerRefusal({ user: 'U2', cur: { ...cur, pr_seen: { state: 'MERGED' } }, env }), null, 'a merged PR frees the thread');
});

test('shipHint names the Open N PRs button, and leaves one repo alone', () => {
  assert.equal(shipHint('Done.\n\nTap Open PR below.', 2), 'Done.\n\nReply `open PR`, or tap Open 2 PRs.');
  assert.equal(shipHint('When ready, tap the Open PR button.', 3), 'When ready, reply `open PR`, or tap Open 3 PRs.');
  assert.equal(shipHint('Tap Open PR below.', 1), 'Tap Open PR below.');
});

test('targetSwitch: the old PR parks, the new one is current, and a switch back restores the old card', () => {
  const p50 = 'https://github.com/mozilla/syncstorage-rs/pull/2750', p38 = 'https://github.com/mozilla/syncstorage-rs/pull/2738';
  const s0 = { pr_url: p50, pr_card_ts: '1.1', pr_seen: { state: 'CLOSED' }, pr_ended: 'CLOSED' };
  const s1 = { ...s0, ...targetSwitch(s0, { url: p38, branch: 'stor-55', from: 'agent-46e5fc' }) };
  assert.equal(s1.pr_url, p38);
  assert.equal(s1.pr_card_ts, null, 'the new PR gets its own card');
  assert.equal(s1.pr_ended, null, "the old PR's end does not end the new one");
  assert.equal(s1.target_cur, 1);
  assert.deepEqual(s1.targets.map((t) => [t.branch, t.state]), [['agent-46e5fc', 'CLOSED'], ['stor-55', 'open']]);
  assert.deepEqual(otherOpen(s1), [], 'a closed target is not followed');
  assert.match(targetsText(s1), /PR 2738> `stor-55` · current/);
  assert.match(targetsText(s1), /PR 2750> `agent-46e5fc` · ended \(closed\)/);
  const s2 = { ...s1, ...targetSwitch(s1, { url: p50, branch: 'agent-46e5fc' }) };
  assert.equal(s2.pr_card_ts, '1.1', 'a switch back finds its card again');
  assert.equal(s2.target_cur, 0);
  assert.equal(s2.targets.length, 2);
  assert.equal(otherOpen({ ...s2, targets: s2.targets.map((t) => ({ ...t, state: 'open' })) }).length, 1);
});
