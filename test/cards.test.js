import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/cards.js';
import { SAMPLES, SAMPLE_ENV } from '../e2e/tools/card-samples.mjs';

beforeEach(() => { Object.assign(process.env, SAMPLE_ENV); delete process.env.PIPE_REPO_SLUG; });

const all = (blocks) => JSON.stringify(blocks ?? []);
const buttons = (blocks) => { const out = []; JSON.stringify(blocks ?? [], (k, v) => { if (v?.type === 'button') out.push(v.action_id); return v; }); return out; };
const urls = (blocks) => [...all(blocks).matchAll(/"(?:url|image_url)":"([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.includes('raw.githubusercontent.com'));

test('every builder returns text, blocks and fallback within the limits', () => {
  for (const [kind, data] of Object.entries(SAMPLES)) {
    const c = C.BUILDERS[kind](data);
    assert.ok(c.text && c.text.length <= 300, kind);
    assert.ok(Array.isArray(c.blocks) && c.blocks.length > 0 && c.blocks.length <= 50, kind);
    assert.ok(c.fallback === null || (c.fallback.length > 0 && c.fallback.length <= 50), kind);
    assert.doesNotMatch(all(c.blocks), /"text":""/, `${kind}: an empty text is rejected`);
    assert.doesNotMatch(all(c.blocks), /—/, kind);
    for (const u of urls(c.blocks).concat(urls(c.fallback))) assert.equal(C.safeUrl(u), u, `${kind}: ${u}`);
    for (const b of JSON.parse(all(c.blocks)).filter((x) => x.type === 'card')) {
      assert.ok(b.title.text.length <= 150 && (b.actions ?? []).length <= 3, kind);
    }
  }
});

test('safeUrl allows github.com, the env bases and Slack permalinks only', () => {
  assert.equal(C.safeUrl('https://github.com/mozilla/fxa/pull/1'), 'https://github.com/mozilla/fxa/pull/1');
  assert.equal(C.safeUrl('https://jira.example.com/browse/FXA-1'), 'https://jira.example.com/browse/FXA-1');
  assert.equal(C.safeUrl('https://example.slack.com/archives/C0/p1'), 'https://example.slack.com/archives/C0/p1');
  for (const bad of ['http://github.com/x', 'https://evil.example.com/', 'https://github.com.evil.example/', 'https://user:pw@github.com/', 'javascript:alert(1)', '', null]) assert.equal(C.safeUrl(bad), '', bad);
  process.env.GRAFANA_URL = 'https://grafana.example.com/base';
  assert.equal(C.safeUrl('https://grafana.example.com/other'), '');
  assert.equal(C.safeUrl('https://grafana.example.com/base/d/1'), 'https://grafana.example.com/base/d/1');
  delete process.env.JIRA_URL;
  assert.equal(C.safeUrl('https://jira.example.com/browse/FXA-1'), '');
});

test('a link outside the allowlist drops the button and keeps the card', () => {
  const c = C.jira(SAMPLES.jira);
  assert.deepEqual(buttons(c.blocks), ['wo_open', 'wo_investigate']);
  delete process.env.JIRA_URL;
  const d = C.jira(SAMPLES.jira);
  assert.deepEqual(buttons(d.blocks), ['wo_investigate']);
  assert.match(d.fallback[0].text.text, /^\*FXA-0000\*/);
  const s = C.sentry({ ...SAMPLES.sentry, permalink: 'https://evil.example.com/x' });
  assert.deepEqual(buttons(s.blocks), ['wo_investigate']);
  assert.doesNotMatch(all(s.fallback), /evil/);
});

test('pr: buttons follow the state order and cap at 3', () => {
  const ids = (d) => buttons(C.pr({ ...SAMPLES.pr, ...d }).blocks);
  assert.deepEqual(ids({ mergeable: 'CONFLICTING', jira: null }), ['wo_open', 'rebase_pr', 'fix_review']);
  assert.deepEqual(ids({ changers: [], ci: 'pass' }), ['wo_open', 'pr_ready']);
  assert.deepEqual(ids({ changers: [], jira: null, ci: 'pending' }), ['wo_open', 'create_jira']);
  assert.deepEqual(ids({ state: 'merged' }), ['wo_open']);
  const c = C.pr({ ...SAMPLES.pr, changers: [], ci: 'pass' });
  assert.equal(c.blocks[0].actions[1].style, 'primary');
  assert.equal(c.blocks[0].block_id, 'pr_999999_v1');
  assert.equal(C.pr({ ...SAMPLES.pr, version: 4 }).blocks[0].block_id, 'pr_999999_v4');
  assert.match(c.blocks[0].subtitle.text, /^`draft` · mozilla\/fxa · \+52 −11 · 2 files$/);
  assert.equal(C.pr({ ...SAMPLES.pr, title: 'x'.repeat(400) }).blocks[0].title.text.length, 150);
});

test('turn: chips, the collapsed stages, no chips after a question', () => {
  const c = C.turn(SAMPLES.turn);
  assert.deepEqual(c.blocks.map((b) => b.type), ['markdown', 'context', 'container', 'actions']);
  assert.equal(c.blocks[2].default_collapsed, true);
  assert.deepEqual(buttons(c.blocks), ['open_pr', 'diff', 'push_branch']);
  assert.deepEqual(c.fallback.map((b) => b.type), ['markdown', 'context', 'actions']);
  assert.match(c.fallback[1].elements[0].text, /✓ Read the code/);
  const q = C.turn({ ...SAMPLES.turn, needsInput: true, stages: [], changes: 0 });
  assert.deepEqual(q.blocks.map((b) => b.type), ['markdown']);
  assert.match(C.turn({ summary: 'Hi <!channel>' }).blocks[0].text, /@channel/);
});

test('tools: three cards, fallback fields', () => {
  const c = C.tools(SAMPLES.tools);
  assert.equal(c.blocks[1].elements.length, 3);
  assert.equal(c.blocks[1].elements[0].subtitle.text, '1 write · 0 read');
  assert.equal(c.fallback[1].fields.length, 3);
});

test('jira: no card for missing or bad data', () => {
  assert.equal(C.jira(null), null);
  assert.equal(C.jira({ key: 'ABC-1' }), null);
  assert.match(C.jira(SAMPLES.jira).blocks[0].subtitle.text, /`In Progress` · Bug · P2/);
});

test('sentry: 24 hours sum into 12 buckets, sparkline in the fallback', () => {
  assert.deepEqual(C.buckets([...Array(24).keys()]), [1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45]);
  const c = C.sentry(SAMPLES.sentry);
  assert.equal(c.blocks[1].chart.series[0].data.length, 12);
  assert.match(c.blocks[0].subtext.text, /first seen 3d ago/);
  assert.match(c.fallback[1].elements[0].text, /^24h [▁-█]{12}/);
  assert.equal(C.sentry({ ...SAMPLES.sentry, hourly: [1, 2] }).blocks.length, 1);
  assert.equal(C.sentry({}), null);
  assert.equal(C.spark([5, 5]), '▁▁');
});

test('ci: infra marked, logs only from links, a tap button only when needed', () => {
  const c = C.ci(SAMPLES.ci);
  const kids = c.blocks[0].child_blocks;
  assert.match(kids[0].text.text, /^:x:/);
  assert.match(kids[1].text.text, /^:warning:/);
  assert.equal(c.blocks[0].subtitle.text, '2 failed · 1 running · 39 passed');
  assert.deepEqual(buttons(c.blocks), ['wo_open', 'wo_open', 'auto_round']);
  assert.deepEqual(buttons(C.ci({ ...SAMPLES.ci, links: [], needsTap: false }).blocks), []);
  const many = C.ci({ number: 1, failing: Array.from({ length: 15 }, (_, i) => `c${i}`) });
  assert.ok(many.blocks[0].child_blocks.length <= 10);
  assert.match(all(many.blocks), /8 more failing checks/);
});

test('review: table of first sentences, outcomes counted, no empty cells', () => {
  const c = C.review({ ...SAMPLES.review, comments: [...SAMPLES.review.comments, { path: 'a.js', body: `${'y'.repeat(300)}. More.` }] });
  const t = c.blocks[0].child_blocks[0];
  assert.equal(t.type, 'table');
  assert.equal(t.rows[1][1].text, 'Check for null before you read the token.');
  assert.equal(t.rows[4][1].text.length, 120);
  assert.equal(t.rows[4][2].text, '-');
  assert.equal(c.blocks[0].subtitle.text, '4 comments · 2 fixed · 1 answered');
  assert.deepEqual(t.column_settings, [{ align: 'left' }, { is_wrapped: true }, { align: 'right' }]);
  assert.equal(c.fallback.length, 1 + 4 + 1);
});

test('tests: pie only when something failed', () => {
  assert.ok(C.tests(SAMPLES.tests).blocks.some((b) => b.type === 'data_visualization'));
  assert.ok(!C.tests({ ...SAMPLES.tests, failed: 0 }).blocks.some((b) => b.type === 'data_visualization'));
  assert.match(C.tests(SAMPLES.tests).blocks.at(-1).elements[0].text, /Plan: 3 unit · 1 integration · 1 functional/);
});

test('deploy: fxa-* apps only, max 10, never a sync or rollback button', () => {
  const apps = Array.from({ length: 12 }, (_, i) => ({ name: `fxa-app-${i}`, sync: 'Synced', health: 'Healthy' }));
  assert.equal(C.deploy({ apps: [...apps, { name: 'other', sync: 'x' }] }).blocks[0].elements.length, 10);
  assert.equal(C.deploy({ apps: [{ name: 'other' }] }), null);
  const c = C.deploy(SAMPLES.deploy);
  assert.deepEqual(c.blocks[0].elements.map((e) => e.slack_icon.name), ['rocket', 'warning']);
  assert.match(c.blocks[0].elements[0].body.text, /`v1\.290\.0` · synced 14:02 UTC/);
  assert.doesNotMatch(all(c), /sync"|rollback/i);
});

test('grafana: line of the points, sparkline in the fallback', () => {
  const c = C.grafana(SAMPLES.grafana);
  assert.equal(c.blocks[1].chart.type, 'line');
  assert.equal(c.blocks[1].chart.series[0].data.length, 12);
  assert.ok(c.blocks[1].chart.series[0].name.length <= 20);
  assert.match(c.fallback[0].text.text, /`[▁-█]{12}` 24h/);
  assert.equal(C.grafana({ ...SAMPLES.grafana, url: 'https://evil.example.com' }).blocks[0].accessory, undefined);
});

test('status: stop is danger with a confirm, no fallback', () => {
  const c = C.status(SAMPLES.status);
  const stop = c.blocks.at(-1).elements[2];
  assert.equal(stop.style, 'danger');
  assert.ok(stop.confirm);
  assert.equal(c.fallback, null);
  assert.match(C.status({ ...SAMPLES.status, owner: '<!channel>' }).blocks[0].fields[2].text, /-$/);
});

test('sessions: an Open cell with a fallback, and section rows', () => {
  const c = C.sessions(SAMPLES.sessions);
  assert.equal(c.blocks[0].rows.length, 3);
  assert.equal(c.blocks[0].rows[1][3].type, 'action_cell');
  assert.equal(c.fallback.length, 2);
  const bad = C.sessions({ rows: [{ key: 'k', task: 't', state: 's', url: 'https://evil.example.com' }] });
  assert.equal(bad.blocks[0].rows[1][3].type, 'raw_text');
});

test('end: feedback buttons only in the primary layout', () => {
  const c = C.end(SAMPLES.end);
  assert.equal(c.blocks.at(-1).type, 'context_actions');
  assert.equal(c.blocks.at(-1).elements[0].positive_button.value, 'k1:up');
  assert.ok(!c.fallback.some((b) => b.type === 'context_actions'));
});

test('bot: table of services, text names what is down', () => {
  const c = C.bot(SAMPLES.bot);
  assert.equal(c.blocks[1].rows.length, 5);
  assert.equal(c.blocks[1].rows[1][2].text, '-');
  assert.match(c.text, /1 of 4 services are not up: MCP: grafana/);
  assert.equal(C.bot({ services: [{ name: 'a', state: 'up' }] }).text, 'All 1 services are up.');
});

test('parseAgentCards: strips fences, keeps valid kind and ref only', () => {
  const fence = (j) => `\`\`\`fxa-card\n${j}\n\`\`\``;
  const r = C.parseAgentCards(['Done.', fence('{"kind":"jira","ref":"FXA-123","title":"x"}'), 'More text.'].join('\n'));
  assert.deepEqual(r.cards, [{ kind: 'jira', ref: 'FXA-123' }]);
  assert.equal(r.text, 'Done.\nMore text.');
  for (const bad of ['not json', '{"kind":"bogus","ref":"1"}', '{"kind":"jira","ref":"ABC-1"}', '{"kind":"pr","ref":"https://github.com/evil/x/pull/1"}',
    `{"kind":"jira","ref":"FXA-1","pad":"${'x'.repeat(500)}"}`, '{"kind":"__proto__","ref":"1"}', '[]', 'null']) {
    const p = C.parseAgentCards(`a\n${fence(bad)}\nb`);
    assert.deepEqual(p.cards, [], bad);
    assert.equal(p.text, 'a\nb', bad);
  }
  assert.deepEqual(C.parseAgentCards(fence('{"kind":"pr","ref":"https://github.com/mozilla/fxa/pull/12"}')).cards, [{ kind: 'pr', ref: 'https://github.com/mozilla/fxa/pull/12' }]);
  assert.deepEqual(C.parseAgentCards('```js\n{"kind":"jira","ref":"FXA-1"}\n```').cards, []);
});

test('parseAgentCards: at most 3 cards, 2 charts, 1 Grafana, no duplicates', () => {
  const f = (k, r) => `\`\`\`fxa-card\n{"kind":"${k}","ref":"${r}"}\n\`\`\``;
  const r = C.parseAgentCards([f('grafana', 'a/1'), f('grafana', 'b/2'), f('sentry', '1'), f('sentry', '2'), f('jira', 'FXA-1'), f('jira', 'FXA-1'), f('ci', '5')].join('\n'));
  assert.deepEqual(r.cards, [{ kind: 'grafana', ref: 'a/1' }, { kind: 'sentry', ref: '1' }, { kind: 'jira', ref: 'FXA-1' }]);
  assert.equal(r.text, '');
});

test('no data field can inject a link or a mention, in any card or its fallback', () => {
  const EVIL = '<https://evil.example|open me> <!here>';
  // Every string becomes the attack, except URL fields, which safeUrl checks on its own.
  const poison = (v, k) => (typeof v === 'string' ? (/url|permalink|^href$/i.test(k ?? '') ? v : EVIL)
    : Array.isArray(v) ? v.map((x) => poison(x, k)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, poison(x, kk)])) : v);
  for (const [kind, data] of Object.entries(SAMPLES)) {
    const c = C.BUILDERS[kind](poison(data));
    if (!c) continue; // the builder refused the data: nothing is posted
    // Only what Slack shows: every "text" string, except a markdown block (the agent's own reply, as today).
    const shown = []; JSON.stringify([c.blocks, c.fallback], (k, v) => { if (v?.type === 'markdown') return undefined; if (k === 'text' && typeof v === 'string') shown.push(v); return v; });
    const out = JSON.stringify([c.text, shown]);
    assert.ok(!out.includes('<https://evil'), `${kind} lets a link through`);
    assert.ok(!out.includes('<!here'), `${kind} lets a mention through`);
  }
});
