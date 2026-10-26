import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routineStart, routineEnd, routineEndLine, routineSkip, routineHint, routineReport, dateToken } from '../src/render.js';
import { botChannels, pollChannels, workspaceUsers } from '../src/routines.js';

const R = { name: 'Code review', team: 'fxa', template: 'code-review', repos: ['mozilla/fxa'], branch: 'main', mode: 'pr+notes', since: 1792414800 };
const ENDS = [{ state: 'ok', pr: 'https://github.com/mozilla/fxa/pull/12', next: 1792501200 }, { state: 'report', post: true, next: 1792501200 },
  { state: 'report', post: false, next: 1792501200 }, { state: 'nochange', next: 1792501200 }, { state: 'failed', reason: 'the handoff check did not pass', next: 1792501200 },
  { state: 'failed', cost: true, next: 1792501200 }, { state: 'stopped', next: 1792501200 }];
const ALL = [routineStart(R), routineStart({ ...R, since: null }), ...ENDS.map((e) => routineEnd(R, e)), ...ENDS.map((e) => routineEndLine(R, e)),
  routineSkip({ name: 'Code review', reason: 'the team reached its daily spend cap', next: 1792501200 }), routineHint('report'), routineHint('pr'), routineHint('run')];

test('routine texts show no dollar amount', () => { for (const t of ALL) assert.ok(!t.includes('$'), t); });

test('each time in a routine text is a Slack date token with a UTC fallback', () => {
  assert.equal(dateToken(1792501200), '<!date^1792501200^{date_short_pretty} at {time}|Tue 20 Oct 13:00 UTC>');
  for (const t of ALL) for (const m of t.matchAll(/\d{9,}/g)) assert.ok(t.includes(`<!date^${m[0]}^`), t);
  assert.match(routineStart(R), /since <!date\^1792414800\^/);
  assert.match(routineStart({ ...R, since: null }), /from the last 24 hours/);
  for (const e of ENDS) assert.match(routineEnd(R, e), /Next run: <!date\^1792501200\^/);
});

test('a routine report has its mentions made inert, and a long one goes as a file', () => {
  const r = routineReport('Finding for <!channel>, <!here> and <@U0123ABC>: <!subteam^S1|devs> too.');
  assert.ok(!/<!|<@/.test(r.text), r.text);
  assert.equal(r.snippet, false);
  assert.equal(routineReport('x'.repeat(2901)).snippet, true);
});

test('a routine report shows the real target of a labelled link', () => {
  const r = routineReport('See <https://evil.example/login|the fixed PR #42> and <mailto:a@example.com|mail>.');
  assert.ok(!r.text.includes('|the fixed PR #42>'), r.text);
  assert.ok(r.text.includes('<https://evil.example/login>') && r.text.includes('<mailto:a@example.com>'), r.text);
});

test('the end texts: PR link, report kept off Slack, failure with the History link', () => {
  process.env.DASHBOARD_URL = 'https://dash.example.com/';
  assert.match(routineEnd(R, ENDS[0]), /^Code review: draft PR <https:\/\/github.com\/mozilla\/fxa\/pull\/12\|#12>\. The findings it did not fix are in the PR description\./);
  assert.match(routineEnd(R, ENDS[2]), /holds data I do not post in Slack.*<https:\/\/dash\.example\.com\/#teams\/fxa\/routines\|History>/);
  // A blank report has nothing in History either: the text does not send the admin there.
  const blank = routineEnd(R, { state: 'report', post: true, posted: false, blank: true });
  assert.match(blank, /^Code review: the run ended with no report\. No code changed\./);
  assert.doesNotMatch(blank, /History/);
  assert.match(routineEnd(R, ENDS[4]), /^Code review failed: the handoff check did not pass\. .*<https:\/\/dash\.example\.com\/#teams\/fxa\/routines\|History>/);
  // With the routine's id, the link opens that routine's History, not the team's newest run.
  assert.match(routineEnd({ ...R, routine: 7 }, ENDS[4]), /#teams\/fxa\/routines\/7\|History>/);
  assert.match(routineEnd(R, ENDS[5]), /^Code review stopped at its cost limit\./);
  delete process.env.DASHBOARD_URL;
});

// The wrappers run a stub ctl that saves its argv: each argument arrives whole, with no shell in between.
test('each routine wrapper passes argv with no shell', async () => {
  const { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const d = mkdtempSync(join(tmpdir(), 'routines-test-'));
  const stub = join(d, 'ctl');
  writeFileSync(stub, `#!/usr/bin/env bash\nprintf '%s\\0' "$@" >> "${d}/argv"; printf '\\n' >> "${d}/argv"\n`
    + `for a; do [ -f "$a" ] && cat "$a" > "${d}/file"; done\ncase " $* " in *" tick "*) echo '{"runs":[],"skips":[]}' ;; *" done "*) echo '{"changed":true,"state":"report","post":true,"next":null}' ;; esac\n`);
  chmodSync(stub, 0o755);
  process.env.FXA_CTL = stub;
  const ctl = await import('../src/ctl.js');
  const evil = 'x $(touch pwned) `id`; rm -rf /tmp/nothing';
  assert.deepEqual(await ctl.routineTick('dev'), { runs: [], skips: [] });
  assert.equal((await ctl.routineDone(7, { state: 'report', session: 'agent-abc123', reason: `${evil}\nline 2`, report: 'the report' })).post, true);
  await ctl.routineDone(8, { state: 'failed', reason: 'refused' });
  await ctl.routinePosted(9);
  // A routine run never waits in the bot's line, so it has no queue time to pass.
  await ctl.routineTask({ key: 'agent-abc123', profile: 'fxa', run: 7, thread: 'C0OUT:1792414800.000100', link: 'https://x.slack.com/p1', queuedS: 30 });
  // The first tick after a start also takes the runs a dead bot claimed and never started.
  await ctl.routineTick('live', true);
  const calls = readFileSync(join(d, 'argv'), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\0').slice(0, -1));
  assert.deepEqual(calls[0], ['--backend', 'gce', 'routine', 'tick', '--env', 'dev']);
  assert.deepEqual(calls.at(-1), ['--backend', 'gce', 'routine', 'tick', '--env', 'live', '--resume']);
  assert.deepEqual(calls[1].slice(0, 10), ['--backend', 'gce', 'routine', 'done', '7', '--state', 'report', '--session', 'agent-abc123', '--reason']);
  assert.equal(calls[1][10], `${evil} line 2`);
  assert.equal(calls[1][11], '--report-file');
  assert.equal(readFileSync(join(d, 'file'), 'utf8'), 'the report');
  assert.deepEqual(calls[2], ['--backend', 'gce', 'routine', 'done', '8', '--state', 'failed', '--reason', 'refused']);
  assert.deepEqual(calls[3], ['--backend', 'gce', 'routine', 'posted', '9']);
  assert.deepEqual(calls[4], ['--backend', 'gce', '--pipeline', 'fxa', 'task', '--source', 'routine', '--routine-run', '7', '--id', 'agent-abc123',
    '--thread', 'C0OUT:1792414800.000100', '--link', 'https://x.slack.com/p1']);
  assert.ok(!existsSync('pwned') && !existsSync(join(d, 'pwned')));
});

test('the channel check fails closed for a private-repo team and a security review', async () => {
  const { channelRefusal } = await import('../src/routines.js');
  const info = (c) => ({ conversations: { info: async () => (c instanceof Error ? Promise.reject(c) : { channel: c }) } });
  const run = { channel: 'C0OUT', private: true, template: 'code-review' };
  assert.equal(await channelRefusal(info({ is_private: true, is_shared: false, is_ext_shared: false }), run), null);
  assert.match(await channelRefusal(info({ is_private: false }), run), /is public/);
  assert.match(await channelRefusal(info({ is_private: true, is_ext_shared: true }), run), /is shared/);
  assert.match(await channelRefusal(info({ is_private: true, is_shared: true }), run), /is shared/);
  assert.match(await channelRefusal(info(new Error('channel_not_found')), run), /cannot read channel C0OUT/);
  assert.match(await channelRefusal(info(null), { ...run, private: false, template: 'security-review' }), /cannot read/);
  assert.equal(await channelRefusal(info(new Error('no')), { ...run, private: false }), null, 'a public team code review needs no lookup');
});

test('a tick that is still running makes the next call do nothing', async () => {
  const { inFlightGuard } = await import('../src/routines.js');
  let n = 0, release;
  const g = inFlightGuard(() => { n++; return new Promise((r) => { release = r; }); });
  const first = g();
  assert.equal(await g(), false);
  release(); assert.equal(await first, true);
  const third = g(); release(); assert.equal(await third, true);
  assert.equal(n, 2);
});

test('a done that did not answer, or changed nothing, says so and never claims the report holds personal data', () => {
  const store = routineEnd(R, { state: 'store' }), ended = routineEnd(R, { state: 'ended', next: 1792501200 });
  assert.match(store, /^Code review: I could not record this run's result, so I post nothing from it\./);
  assert.match(ended, /^Code review: this run had ended already\./);
  for (const t of [store, ended]) { assert.ok(!/holds data/.test(t), t); assert.ok(!t.includes('$'), t); }
});

test('the start message ends as one line with the result word, and points to the reply (D22)', () => {
  assert.deepEqual(['ok', 'report', 'nochange', 'failed', 'stopped', 'store'].map((state) => routineEndLine(R, { state })),
    ['done', 'done', 'no change', 'failed', 'stopped', 'not recorded'].map((w) => `Code review: ${w}. See the reply in this thread.`));
});

test('a cost-limit stop ends the start message as stopped, as its reply says, and an ended run as ended', () => {
  assert.equal(routineEndLine(R, { state: 'failed', cost: true }), 'Code review: stopped. See the reply in this thread.');
  assert.match(routineEnd(R, { state: 'failed', cost: true }), /^Code review stopped at its cost limit\./);
  assert.equal(routineEndLine(R, { state: 'ended' }), 'Code review: ended. See the reply in this thread.');
});

test('a routine with no channel needs no channel check, and its Slack calls are muted (D32)', async () => {
  const { channelRefusal, NO_CHANNEL, muted, mutedReply } = await import('../src/routines.js');
  const never = { conversations: { info: async () => { throw new Error('no lookup for a routine with no channel'); } } };
  assert.equal(await channelRefusal(never, { private: true, template: 'security-review' }), null);
  assert.equal(muted({ channel: NO_CHANNEL }), true);
  assert.equal(muted({ channel_id: NO_CHANNEL }), true);
  assert.equal(muted({ channel: 'C0OUT' }), false);
  const a = mutedReply(), b = mutedReply();
  assert.match(a.ts, /^\d+\.\d{6}$/);
  assert.notEqual(a.ts, b.ts);
});

test('a routine thread says a report is there only when one posted, and its hint follows how the run ended', () => {
  assert.match(routineEnd(R, { state: 'report', post: true, posted: false }), /^Code review: the run ended with no report I could post here\..*History/);
  assert.doesNotMatch(routineEnd(R, { state: 'report', post: true, posted: false }), /the report is in this thread/);
  assert.match(routineEnd(R, { state: 'report', post: true, posted: true }), /the report is in this thread/);
  assert.match(routineHint('run'), /^This thread is for a routine run\. I do not take requests here\./);
  assert.doesNotMatch(routineHint('run'), /holds a routine's report|PR link/);
});

const slackErr = (error) => Object.assign(new Error(error), { data: { error } });
const client = (pages) => { const calls = []; return { calls, users: { conversations: async (a) => { calls.push(a.types); const p = pages(a); if (p instanceof Error) throw p; return p; } } }; };

test('the channel list reads every page, with private and shared from Slack', async () => {
  const c = client((a) => (a.cursor ? { channels: [{ id: 'C2', name: 'two', is_private: true, is_ext_shared: true }] }
    : { channels: [{ id: 'C1', name: 'one' }], response_metadata: { next_cursor: 'p2' } }));
  assert.deepEqual(await botChannels(c), [{ id: 'C1', name: 'one', private: false, shared: false }, { id: 'C2', name: 'two', private: true, shared: true }]);
});

test('without channels:read the channel list falls back to private channels; another error is thrown', async () => {
  const c = client((a) => (a.types.includes('public') ? slackErr('missing_scope') : { channels: [{ id: 'G1', name: 'priv', is_private: true }] }));
  assert.deepEqual(await botChannels(c), [{ id: 'G1', name: 'priv', private: true, shared: false }]);
  assert.deepEqual(c.calls, ['public_channel,private_channel', 'private_channel']);
  await assert.rejects(botChannels(client(() => slackErr('ratelimited'))), /ratelimited/);
  await assert.rejects(botChannels(client(() => slackErr('missing_scope'))), /missing_scope/);
});

test('without groups:read the channel list falls back to public channels', async () => {
  const c = client((a) => (a.types.includes('private') ? slackErr('missing_scope') : { channels: [{ id: 'C1', name: 'pub' }] }));
  assert.deepEqual(await botChannels(c), [{ id: 'C1', name: 'pub', private: false, shared: false }]);
  assert.deepEqual(c.calls, ['public_channel,private_channel', 'private_channel', 'public_channel']);
});

test('the user list reads every page, and leaves out bots, deactivated accounts and Slackbot', async () => {
  const c = { users: { list: async (a) => (a.cursor
    ? { members: [{ id: 'U2', name: 'pat', profile: { real_name: 'Pat Doe', display_name: 'pat', email: 'pat@example.com' } }, { id: 'U3', deleted: true, name: 'x' }] }
    : { members: [{ id: 'USLACKBOT', name: 'slackbot' }, { id: 'B1', is_bot: true, name: 'bot' }, { id: 'U1', name: 'sam', real_name: 'Sam' }], response_metadata: { next_cursor: 'p2' } }) } };
  assert.deepEqual(await workspaceUsers(c), [{ id: 'U1', name: 'Sam', handle: 'sam', email: '' }, { id: 'U2', name: 'Pat Doe', handle: 'pat', email: 'pat@example.com' }]);
});

test('a missing scope names the scope Slack wants and the reinstall step', async () => {
  const quiet = console.error, said = []; console.error = (...a) => said.push(a.join(' '));
  try {
    const e = Object.assign(new Error('missing_scope'), { data: { error: 'missing_scope', needed: 'groups:read', provided: 'chat:write' } });
    await pollChannels(client(() => { throw e; }), () => {}, 60000);
    assert.match(said.join('\n'), /groups:read/);
    assert.match(said.join('\n'), /reinstall/);
  } finally { console.error = quiet; }
});

test('a missing scope stops the channel list polling; another error keeps it', async () => {
  const quiet = console.error; console.error = () => {};
  try {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const scope = client(() => slackErr('missing_scope'));
    await pollChannels(scope, () => {}, 5); await wait(40);
    assert.equal(scope.calls.length, 3, 'both types, then private, then public, and no more');
    const lists = [], busy = client(() => slackErr('ratelimited')), ok = client(() => ({ channels: [{ id: 'G1', name: 'p', is_private: true }] }));
    await pollChannels(busy, () => {}, 5); await pollChannels(ok, (l) => lists.push(l), 5); await wait(40);
    assert.ok(busy.calls.length > 2, `a rate limit polls again (${busy.calls.length} calls)`);
    assert.ok(lists.length > 1 && lists[0][0].id === 'G1', 'each list is written');
  } finally { console.error = quiet; }
});
