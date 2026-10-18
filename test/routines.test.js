import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routineStart, routineEnd, routineSkip, routineHint, routineReport, dateToken } from '../src/render.js';

const R = { name: 'Code review', team: 'fxa', template: 'code-review', repos: ['mozilla/fxa'], branch: 'main', mode: 'pr+notes', since: 1792414800 };
const ENDS = [{ state: 'ok', pr: 'https://github.com/mozilla/fxa/pull/12', next: 1792501200 }, { state: 'report', post: true, next: 1792501200 },
  { state: 'report', post: false, next: 1792501200 }, { state: 'nochange', next: 1792501200 }, { state: 'failed', reason: 'the handoff check did not pass', next: 1792501200 },
  { state: 'failed', cost: true, next: 1792501200 }, { state: 'stopped', next: 1792501200 }];
const ALL = [routineStart(R), routineStart({ ...R, since: null }), ...ENDS.map((e) => routineEnd(R, e)),
  routineSkip({ name: 'Code review', reason: 'the team reached its daily spend cap', next: 1792501200 }), routineHint('report'), routineHint('pr')];

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

test('the end texts: PR link, report kept off Slack, failure with the History link', () => {
  process.env.DASHBOARD_URL = 'https://dash.example.com/';
  assert.match(routineEnd(R, ENDS[0]), /^Code review: draft PR <https:\/\/github.com\/mozilla\/fxa\/pull\/12\|#12>\. The findings it did not fix are in the PR description\./);
  assert.match(routineEnd(R, ENDS[2]), /holds data I do not post in Slack.*<https:\/\/dash\.example\.com\/#team=fxa\|History>/);
  assert.match(routineEnd(R, ENDS[4]), /^Code review failed: the handoff check did not pass\. .*<https:\/\/dash\.example\.com\/#team=fxa\|History>/);
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
  await ctl.routineTask({ key: 'agent-abc123', profile: 'fxa', run: 7, thread: 'C0OUT:1792414800.000100', link: 'https://x.slack.com/p1' });
  const calls = readFileSync(join(d, 'argv'), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\0').slice(0, -1));
  assert.deepEqual(calls[0], ['--backend', 'gce', 'routine', 'tick', '--env', 'dev']);
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
