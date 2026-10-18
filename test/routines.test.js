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
