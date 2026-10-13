// A team stack: one session over several repos (fxa-sandbox-ctl lib/trees.sh). The pure
// parts live here: the !stack picker cards, the turn-end buttons for each repo, and the
// follow state of each repo's PR.

import { mayStart } from './profile.js';

const SLUG = /^[\w.-]+\/[\w.-]+$/;
const PR = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)\/?$/;

// "!stack", "!stack <team>", "!stack checkout <PR link>", "!stack help". Slack wraps a link as
// <url> or <url|label>. "add" and "help" are words, not teams.
export const STACK_ADD = '`!stack add` is not a command. To add a repo to this thread\'s session: `!stop` it if it runs, send `!stack`, pick the same team and tick the repo to add, then tag me. The session resumes with that repo too.';
export function parseStack(text) {
  const [, sub = '', arg = ''] = String(text ?? '').trim().match(/^!stack(?:\s+(\S+))?(?:\s+(\S+))?/i) ?? [];
  if (!sub) return { sub: 'pick' };
  if (sub.toLowerCase() === 'add') return { sub: 'add', error: STACK_ADD };
  if (sub.toLowerCase() === 'help') return { sub: 'help' };
  if (sub.toLowerCase() !== 'checkout') return { sub: 'pick', team: sub.toLowerCase() };
  const url = arg.replace(/^<([^|>]+)(\|[^>]*)?>$/, '$1');
  const m = url.match(PR);
  return m ? { sub: 'checkout', url: url.replace(/\/$/, ''), slug: m[1] } : { sub: 'checkout', error: 'Give me a GitHub PR link: `!stack checkout https://github.com/<owner>/<repo>/pull/<n>`.' };
}

// The !stack commands, and the teams this person may pick.
export function stackHelp(teams) {
  return ['`!stack`: pick a team and its repos for this thread. Your next tag starts the session with them.',
    '`!stack <team>`: skip the team step.',
    '`!stack checkout <PR link>`: continue a PR in this thread.',
    `Your teams: ${teams.map((t) => `\`${t.profile}\``).join(', ')}.`].join('\n');
}

// The teams a person may pick: every profile, less the gated ones they are not on.
export function teamsFor(profiles, user, env = process.env) {
  return profiles.filter((p) => mayStart(p.profile, user, env));
}

// Step 1: which team. The select's value is the profile name.
export function stackTeamCard(teams) {
  return {
    text: 'Pick a team for this thread.',
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*Team stack.* Pick a team, then its repos. Your next tag here starts the session with them.' },
      accessory: { type: 'static_select', action_id: 'stack_team', placeholder: { type: 'plain_text', text: 'Team' },
        options: teams.slice(0, 100).map((t) => ({ text: { type: 'plain_text', text: String(t.label || t.profile).slice(0, 75) }, value: t.profile })) } }],
  };
}

// Step 2: which of the team's repos, its defaults ticked. A repo the App cannot push to ships as a diff.
export function stackRepoCard(team, picked) {
  const work = (team.repos ?? []).filter((r) => r.role === 'work' && SLUG.test(r.slug));
  const option = (r) => ({ text: { type: 'plain_text', text: `${r.slug}${r.write ? '' : ' (diff)'}`.slice(0, 75) }, value: r.slug });
  const chosen = picked ?? (team.defaults?.length ? team.defaults : work.slice(0, 1).map((r) => r.slug));
  const initial = work.filter((r) => chosen.some((c) => c.toLowerCase() === r.slug.toLowerCase())).map(option);
  return {
    text: `Pick ${team.label || team.profile}'s repos.`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*${team.label || team.profile}.* Which repos? Each one ships on its own: a PR where I can push, else a diff.` },
        accessory: { type: 'multi_static_select', action_id: 'stack_repos', placeholder: { type: 'plain_text', text: 'Repos' },
          options: work.map(option), ...(initial.length ? { initial_options: initial } : {}) } },
      { type: 'actions', elements: [{ type: 'button', style: 'primary', text: { type: 'plain_text', text: 'Use these' }, action_id: 'stack_go', value: team.profile }] },
    ],
  };
}

// The turn-end rows for a stack: one row for each repo with changes. A button's value is
// "<key>|<slug>". No PR buttons on a read-only profile or a repo that ships as a diff.
export function treeRows(key, trees, { readOnly = false } = {}) {
  return (trees ?? []).filter((t) => t.changes > 0 && SLUG.test(t.slug ?? '')).map((t) => {
    const name = String(t.name || t.slug.split('/')[1]).slice(0, 30);
    const ship = readOnly || t.out !== 'pr' ? [] : t.pr ? [[`Update PR · ${name}`, 'open_pr']] : [[`Open PR · ${name}`, 'open_pr'], [`Push · ${name}`, 'push_branch']];
    return { type: 'actions', elements: [[`Diff · ${name}`, 'diff'], ...ship].map(([label, action]) => ({
      type: 'button', text: { type: 'plain_text', text: label }, action_id: action, value: `${key}|${t.slug}` })) };
  });
}

// A button value's repo: "<key>|<slug>" or "<key>|<login>|<slug>"; null for none.
export function valueRepo(value) {
  const parts = String(value ?? '').split('|');
  const r = parts.length >= 3 ? parts[2] : parts[1];
  return r && SLUG.test(r) ? r : null;
}

// The PR fields the follower reads and writes. A stack keeps one set for each repo in .prs.
export const PR_FIELDS = ['pr_url', 'pr_seen', 'pr_follow_since', 'pr_pushed_at', 'pr_card_ts', 'pr_card_head', 'pr_card_text',
  'ci_seen', 'ci_pass_at', 'copilot_seen_at', 'auto_rounds', 'nudged_at', 'pr_follow_done', 'pr_ended', 'round_text', 'round_ship'];

// The session as the follower sees one repo's PR: its PR fields over the session's. No repo: the session.
export const prView = (s, repo) => (s && repo ? { ...s, ...Object.fromEntries(PR_FIELDS.map((f) => [f, s.prs?.[repo]?.[f]])), repo } : s);

// The patch that writes PR fields for a view: into .prs[repo] for a stack, else at the top.
// Other fields (state, then_wrap) always go to the top.
export function prPatch(cur, repo, fields) {
  if (!repo) return fields;
  const pr = {}, top = {};
  for (const [k, v] of Object.entries(fields)) (PR_FIELDS.includes(k) ? pr : top)[k] = v;
  return { ...top, prs: { ...(cur?.prs ?? {}), [repo]: { ...(cur?.prs?.[repo] ?? {}), ...pr } } };
}

// The repos whose PRs the follower watches: each in .prs, or the session's one PR.
export const followTargets = (s) => (s.prs && Object.keys(s.prs).length ? Object.keys(s.prs).map((r) => prView(s, r)) : [s]);

// A move to another thread: the PR state carries over, but each card stays in the old thread.
export function carryPrs(prs, moved) {
  if (!prs) return undefined;
  return Object.fromEntries(Object.entries(prs).map(([r, p]) => [r, moved ? { ...p, pr_card_ts: null, pr_card_head: null, pr_card_text: null } : { ...p }]));
}
