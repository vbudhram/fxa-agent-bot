import { defuse, RUNTIMES, isCopilot } from './render.js';

// Card catalog: one pure builder per kind, data object in, {text, blocks, fallback} out.
// fallback is the block list to send once when Slack answers invalid_blocks (null: none).
// Every field comes from ctl data, never from the agent; every URL must pass safeUrl.

const L = { title: 150, body: 200, buttons: 3, carousel: 10, children: 10, blocks: 50, md: 11_500, text: 300 };

// Data text never carries Slack markup: < and > become look-alikes, so no value (a PR title, a
// reviewer's comment, the agent's status) can open a link or a mention. Builders add their own after.
const cut = (s, n) => { const t = defuse(s).replace(/</g, '‹').replace(/>/g, '›').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const pt = (text, n = L.title) => ({ type: 'plain_text', text: cut(text, n) || '-' });
const mk = (text, n = L.body) => ({ type: 'mrkdwn', text: String(text).slice(0, n) || '-' });
// Plain words, not code pills: monospace on every fact made each card busy on a phone.
const pill = (s) => (s ? cut(s, 40) : '');
const cap = (s) => (s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : '');
const dot = (...parts) => parts.filter(Boolean).join(' · ');
const count = (n, label) => (n ? `${n} ${label}` : '');
const nfiles = (n) => `${num(n)} file${n === 1 ? '' : 's'}`;
const ctx = (...t) => ({ type: 'context', elements: t.filter(Boolean).map((x) => mk(x, 3000)) });
const sec = (text, accessory) => ({ type: 'section', text: mk(text, 3000), ...(accessory ? { accessory } : {}) });
const footer = (...t) => ctx(dot(...t));
const ICONS = 'https://raw.githubusercontent.com/vbudhram/fxa-agent-bot/main/assets';
const logo = (name, alt) => ({ type: 'image', image_url: `${ICONS}/${name}.png`, alt_text: alt });
const SPARK = '▁▂▃▄▅▆▇█';
export const spark = (vals) => { const lo = Math.min(...vals), hi = Math.max(...vals);
  return vals.map((v) => SPARK[hi === lo ? 0 : Math.round(((v - lo) / (hi - lo)) * 7)]).join(''); };
const num = (n) => (Number.isFinite(n) ? n : 0);
const ago = (iso, now = Date.now()) => { const m = Math.round((now - Date.parse(iso)) / 60_000);
  return !Number.isFinite(m) || m < 0 ? '' : m < 60 ? `${m}m ago` : m < 2880 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

// URL allowlist: github.com, and the Jira, Sentry, Argo CD and Grafana bases from env, and Slack permalinks.
export function safeUrl(u) {
  let url; try { url = new URL(String(u ?? '')); } catch { return ''; }
  if (url.protocol !== 'https:' || url.username || url.password) return '';
  if (url.host === 'github.com' || /^[a-z0-9-]+\.slack\.com$/.test(url.host)) return url.href;
  const bases = ['JIRA_URL', 'SENTRY_URL', 'ARGO_URL', 'GRAFANA_URL'].map((k) => process.env[k]).filter(Boolean);
  return bases.some((b) => { try { const x = new URL(b); return x.origin === url.origin && url.pathname.startsWith(x.pathname.replace(/\/?$/, '/')); } catch { return false; } }) ? url.href : '';
}
// A mrkdwn link when the URL is allowed, else the bare label.
const link = (url, label) => { const u = safeUrl(url), l = cut(label, 150).replace(/[<>|]/g, ''); return u ? `<${u}|${l}>` : l; };
const btn = (text, action_id, value, { url, style, confirm } = {}) => ({ type: 'button', text: pt(text, 75), action_id, ...(value ? { value: String(value).slice(0, 2000) } : {}),
  ...(url ? { url } : {}), ...(style ? { style } : {}), ...(confirm ? { confirm } : {}) });
// A link button, or null when the URL is not allowed: the card stays, the button goes.
const open = (text, url, value) => (safeUrl(url) ? btn(text, 'wo_open', value, { url: safeUrl(url) }) : null);
const btns = (...b) => b.filter(Boolean).slice(0, L.buttons);
const actions = (els) => (els.length ? [{ type: 'actions', elements: els }] : []);
const jiraUrl = (key) => (process.env.JIRA_URL && /^FXA-\d+$/.test(key ?? '') ? `${process.env.JIRA_URL.replace(/\/+$/, '')}/browse/${key}` : '');
const plain = (t) => cut(String(t ?? '').replace(/[*_`>|]/g, ''), L.text);
const capBlocks = (b) => b.slice(0, L.blocks);

function _pr(d) {
  const n = d.number, url = safeUrl(d.url);
  const state = d.state === 'merged' || d.state === 'closed' ? d.state : d.draft ? 'draft' : 'open';
  const conflict = d.mergeable === 'CONFLICTING', changers = d.changers ?? [], approvers = d.approvers ?? [];
  const ciLine = d.ci === 'fail' ? `CI failed on ${(d.failing ?? []).slice(0, 2).map(pill).join(', ') || 'a check'}${d.checks ? ` · ${num(d.checks) - num(d.failed)} of ${d.checks} passed` : ''}`
    : d.ci === 'pass' ? `✓ CI passed${d.checks ? ` · ${d.checks} checks` : ''}` : d.ci === 'pending' ? `CI running${d.running ? ` · ${d.running} checks left` : ''}` : 'No CI result yet';
  const rev = changers.length ? `Changes requested by ${changers.slice(0, 3).join(', ')}` : approvers.length ? `Approved by ${approvers.slice(0, 3).join(', ')}` : 'No review yet';
  const jiraLine = d.jira ? `Jira ${link(jiraUrl(d.jira), d.jira)}` : 'No Jira ticket';
  // State buttons in order: conflict, review changes, draft with green CI, no Jira.
  const live = state === 'open' || state === 'draft';
  const next = live ? [conflict && btn('Rebase onto main', 'rebase_pr', d.key), changers.length && btn('Fix review', 'fix_review', d.key),
    state === 'draft' && d.ci === 'pass' && btn('Mark ready', 'pr_ready', d.key), !d.jira && btn('Create Jira', 'create_jira', d.key)].filter(Boolean) : [];
  if (next[0]) next[0].style = 'primary';
  const repo = d.repo && d.repo !== (process.env.PIPE_REPO_SLUG || 'mozilla/fxa') ? d.repo : '';
  const subtitle = dot(cap(conflict ? 'merge conflict' : state), repo, d.additions != null && `+${d.additions} −${num(d.deletions)}`, d.files != null && nfiles(d.files));
  const title = `#${n} ${d.title ?? ''}`;
  return {
    text: plain(`PR #${n} is ${state}. ${ciLine.replace(/^:x: |^✓ /, '')}. ${rev}.`),
    blocks: [({ type: 'card', block_id: `pr_${n}_v${d.version ?? 1}`, icon: logo('github', 'GitHub'), title: pt(title), subtitle: mk(subtitle), body: mk(ciLine), subtext: mk(dot(rev, jiraLine)),
      actions: btns(next[0], url && btn('Open', 'wo_open', d.key, { url })) })],
    fallback: [sec(`*${link(url, title)}*\n${subtitle}`, url ? btn('Open', 'wo_open', d.key, { url }) : undefined), ctx(dot(ciLine, rev, jiraLine)), ...actions(btns(next[0]))],
  };
}

function _turn(d) {
  // One quiet line: what changed, whether the tests pass, how long. Only problems get more.
  const chips = d.needsInput ? [] : [dot(d.files != null && `${nfiles(d.files)} +${num(d.added)} −${num(d.removed)}`,
    d.tests && `${d.tests.failed ? `${d.tests.failed} tests failed` : `${d.tests.passed} tests pass`}`, num(d.lint) > 0 && `${d.lint} lint errors`,
    num(d.types) > 0 && `${d.types} type errors`, d.todos && d.todos.done < d.todos.total && `${d.todos.total - d.todos.done} todos open`, d.elapsed)].filter(Boolean);
  const stages = (d.stages ?? []).slice(0, 20).map((s) => cut(s, 100));
  const changes = num(d.changes) > 0;
  const acts = btns(changes && !d.pr && btn('Open PR', 'open_pr', d.key, { style: 'primary' }), changes && btn('Diff', 'diff', d.key),
    d.more && btn('Show more', 'more', d.key)); // Push branch stays a command (!push): a fourth full-width button fills a phone screen
  const body = { type: 'markdown', text: defuse(d.summary).slice(0, L.md) || 'Done.' };
  return {
    text: plain(String(d.summary ?? '').split('\n')[0]) || 'Reply',
    blocks: [body, ...(chips.length ? [ctx(...chips)] : []),
      ...(stages.length ? [{ type: 'container', title: pt('What I did'), is_collapsible: true, default_collapsed: true, child_blocks: [{ type: 'rich_text', elements: [{ type: 'rich_text_list', style: 'bullet',
        elements: stages.map((s) => ({ type: 'rich_text_section', elements: [{ type: 'text', text: `✓ ${s}` }] })) }] }] }] : []), ...actions(acts)],
    fallback: [body, ...(chips.length || stages.length ? [ctx(dot(...chips, stages.map((s) => `✓ ${s}`).join(' ')))] : []), ...actions(acts)],
  };
}

function _tools(d) {
  const repos = d.repos ?? [], mcp = d.mcp ?? [], rt = RUNTIMES[d.runtime] ?? { name: d.runtime ?? 'Claude' };
  const repoLine = repos.map((r) => `${pill(r.slug)} ${r.write ? 'write' : 'read'}`).join(', ') || 'No repos';
  const head = ctx(dot(`*${cut(d.profile ?? 'fxa', 40)}* profile`, rt.name, d.read_only ? 'read only' : 'read and write'));
  return {
    text: plain(`This session uses ${repos.map((r) => `${r.slug} (${r.write ? 'write' : 'read'})`).join(', ') || 'no repos'}, and connects to ${mcp.join(', ') || 'no connectors'}.`),
    // Two lines, not a carousel: on a phone the second card hid behind a swipe.
    blocks: [{ ...head, elements: [mk(`${head.elements[0].text}\n${dot(repoLine, mcp.map((m) => cut(m, 30)).join(', ') || 'no connectors')}`, 3000)] }],
    fallback: null,
  };
}

// Null data (a hidden or unreadable ticket) gives no card: the link stays in the text.
// The layout of the Jira app's own Slack message: the key and summary as one link, a row of labelled
// fields with "(none)" or "Unassigned" for an empty one, and one menu for the actions.
const noneWord = (v) => (v && !/^\(?none\)?$/i.test(v) ? v : '(none)');
function _jira(d) {
  if (!d?.key || !/^FXA-\d+$/.test(d.key)) return null;
  const url = safeUrl(jiraUrl(d.key)), field = (k, v) => `${k}: *${v}*`;
  const more = { type: 'overflow', action_id: 'wo_investigate', options: [{ text: pt('Investigate', 75), value: `jira:${d.key}` },
    ...(url ? [{ text: pt('Open in Jira', 75), value: 'open', url }] : [])] };
  return {
    text: plain(`${d.key}: ${d.summary}. ${d.status ?? ''}`),
    blocks: [sec(`*${link(url, `${d.key} ${d.summary ?? ''}`)}*`, more),
      ctx(field('Status', cut(d.status ?? 'Unknown', 40)), field('Type', cut(d.type ?? 'Task', 30)),
        field('Assignee', d.assignee ? cut(d.assignee, 40) : 'Unassigned'), field('Priority', cut(noneWord(d.priority), 20)))],
    fallback: null,
  };
}

// 24 hourly counts → 12 two-hour buckets: a series holds at most 20 points.
export const buckets = (h) => Array.from({ length: 12 }, (_, i) => num(h[2 * i]) + num(h[2 * i + 1]));

function _sentry(d) {
  if (!d?.id) return null;
  const url = safeUrl(d.permalink), sub = dot(d.project, cap(d.status));
  const h = d.hourly?.length === 24 ? buckets(d.hourly) : null;
  // A text trend: Slack draws block characters as solid white bars.
  const body = dot(`*${num(d.count)}* events · *${num(d.userCount)}* users in 24h`, h && `${h.at(-1) > h[0] * 2 ? 'rising' : h.at(-1) * 2 < h[0] ? 'falling' : 'steady'}, ${h[0]} → ${h.at(-1)} per 2h`);
  const seen = d.firstSeen ? `First seen ${ago(d.firstSeen, d.now)}` : '';
  const inv = btn('Investigate', 'wo_investigate', `sentry:${d.id}`, { style: 'primary' });
  return {
    text: plain(`Sentry ${d.shortId ?? d.id}: ${d.title}. ${num(d.count)} events, ${num(d.userCount)} users in 24h.`),
    blocks: [({ type: 'card', block_id: `sentry_${d.id}`, icon: logo('sentry', 'Sentry'), title: pt(d.title), subtitle: mk(sub), body: mk(body),
      ...(seen ? { subtext: mk(seen) } : {}), actions: btns(inv, open('Open', url, d.id)) })],
    fallback: [sec(`*${link(url, d.title)}*\n${dot(sub, body)}`, inv), ...(h || seen ? [ctx(dot(h && `24h ${spark(h)}`, seen))] : [])],
  };
}

function _ci(d) {
  const failing = d.failing ?? [], infra = new Set(d.infra ?? []), links = new Map((d.links ?? []).map((l) => [l.name, l.url]));
  const counts = dot(count(failing.length, 'failed'), count(d.running, 'running'), count(d.passed, 'passed'));
  const rows = failing.slice(0, 7).map((f) => { const u = safeUrl(links.get(f));
    return sec(infra.has(f) ? `*${pill(f)}*\nInfra failure, not the change` : `*${pill(f)}*\nFailed`, u ? btn('Logs', 'wo_open', d.key, { url: u }) : undefined); });
  const tail = [...(failing.length > 7 ? [ctx(`${failing.length - 7} more failing checks`)] : []), ...(d.needsTap && d.why ? [ctx(cut(d.why, 300))] : []),
    ...actions(d.needsTap ? [btn('Run a round', 'auto_round', d.key, { style: 'primary' })] : [])];
  return {
    text: plain(`CI on PR #${d.number}: ${counts || 'no checks'}.`),
    blocks: [{ type: 'container', title: pt(`CI on #${d.number}`), ...(counts ? { subtitle: pt(counts) } : {}), child_blocks: [...rows, ...tail].slice(0, L.children) }],
    fallback: [sec(`*CI on #${d.number}*${counts ? ` · ${counts}` : ''}`), ...rows, ...tail],
  };
}

// First sentence of a review comment, cut to 120 chars.
const firstSentence = (t) => cut(String(t ?? '').split(/(?<=[.!?])\s/)[0], 120);
function _review(d) {
  const cs = (d.comments ?? []).slice(0, 40), by = {};
  for (const c of cs) if (c.outcome) by[c.outcome] = (by[c.outcome] ?? 0) + 1;
  const sub = dot(`${cs.length} comment${cs.length === 1 ? '' : 's'}`, ...Object.entries(by).map(([k, v]) => `${v} ${k}`));
  const where = (c) => `${String(c.path ?? '').split('/').pop()}${c.line ? `:${c.line}` : ''}`;
  const title = `${cut(d.who ?? 'Copilot', 40)} review on #${d.number}`;
  const act = actions(d.action === 'auto_round' ? [btn('Run a round', 'auto_round', d.key, { style: 'primary' })] : d.action === 'fix_review' ? [btn('Fix review', 'fix_review', d.key)] : []);
  return {
    text: plain(`${title}: ${sub}.`),
    // One line per comment: a three-column table cut off its outcome column at phone width.
    blocks: [{ type: 'container', title: pt(title), subtitle: pt(sub), is_collapsible: true, child_blocks: [
      sec(cs.map((c) => `${c.outcome ? `*${cut(c.outcome, 30)}* ` : ''}${pill(where(c))} ${firstSentence(c.body)}`).join('\n') || 'No comments'), ...act] }],
    fallback: [sec(`*${title}* · ${sub}`), ...cs.slice(0, 45).map((c) => sec(`${pill(where(c))} ${firstSentence(c.body)}${c.outcome ? ` · *${cut(c.outcome, 30)}*` : ''}`)), ...act].slice(0, L.blocks),
  };
}

function _tests(d) {
  const errs = (n, what) => (n == null ? '' : n ? `*${n} ${what} errors*` : `${what} clean`);
  const line = sec(dot(`${num(d.passed)} passed`, num(d.failed) > 0 && `*${d.failed} failed*`, errs(d.lint, 'lint'), errs(d.types, 'types')));
  const levels = {}; for (const p of d.plan ?? []) levels[p.level] = (levels[p.level] ?? 0) + 1;
  const plan = Object.keys(levels).length ? footer(`Plan: ${dot(...Object.entries(levels).map(([k, v]) => `${v} ${cut(k, 20)}`))}`, '/fxa-verify') : footer('/fxa-verify');
  return {
    text: plain(`Tests: ${num(d.passed)} passed, ${num(d.failed)} failed.${d.lint != null ? ` Lint ${d.lint} errors.` : ''}${d.types != null ? ` Types ${d.types} errors.` : ''}`),
    blocks: [line, plan],
    fallback: null,
  };
}

// Read only: never a sync or rollback button.
function _deploy(d) {
  const apps = (d.apps ?? []).filter((a) => /^fxa-[a-z0-9-]{1,50}$/.test(a.name ?? '')).slice(0, L.carousel);
  if (!apps.length) return null;
  const ok = (a) => a.sync === 'Synced' && a.health === 'Healthy';
  const ver = (a) => pill(String(a.images?.[0] ?? '').split(':').pop() || a.revision?.slice(0, 12));
  const time = (a) => (a.finishedAt && !Number.isNaN(Date.parse(a.finishedAt)) ? `synced ${new Date(a.finishedAt).toISOString().slice(11, 16)} UTC` : '');
  return {
    text: plain(apps.map((a) => `${a.name} is ${a.sync} and ${a.health}`).join('. ')),
    // One line per app: in a carousel the second app's buttons were cut off.
    blocks: apps.map((a) => sec(dot(`${ok(a) ? '✓' : '⚠'} *${link(a.url, a.name)}*`, !ok(a) && `${pill(a.sync)}, ${pill(a.health)}`, ver(a), time(a), a.unhealthy && `${a.unhealthy} resources not healthy`),
      ok(a) ? open('Argo CD', a.url, a.name) ?? undefined : btn('Investigate', 'wo_investigate', `argo:${a.name}`))),
    fallback: null,
  };
}

function _grafana(d) {
  const pts = (d.points ?? []).map(Number).filter(Number.isFinite).slice(-12);
  const u = cut(d.unit ?? '', 10), url = safeUrl(d.url), acc = url ? btn('Open in Grafana', 'wo_open', undefined, { url }) : undefined;
  const range = pts.length ? `24h range ${Math.min(...pts)} to ${Math.max(...pts)} ${u}` : '';
  return {
    text: plain(`${d.title} is ${d.now} ${u} now.`),
    blocks: [sec(`*${cut(d.title, 150)}*\n${dot(`*${d.now} ${u}* now`, range, pts.length > 1 && `peak at ${Math.round((pts.indexOf(Math.max(...pts)) * 24) / pts.length)}h`)}`, acc)],
    fallback: [sec(`*${cut(d.title, 150)}*\n${dot(`*${d.now} ${u}* now`, pts.length > 1 && `\`${spark(pts)}\` 24h`)}`, acc)],
  };
}

function _status(d) {
  const p = d.pr, url = safeUrl(p?.url);
  return {
    text: plain(`Session is ${d.state}, ${num(d.minutes)} min.${d.now ? ` Now: ${d.now}` : ''}`),
    blocks: [sec(`${dot(`*${cap(pill(d.state))}*`, `${num(d.minutes)} min`, d.turns != null && `${num(d.turns)} turns`)}${d.now ? `\nNow: ${cut(d.now, 300)}` : ''}`),
    // A team stack: one row for each repo, with its PR or "ships as a diff", and its changes.
    ...(d.trees?.length ? d.trees.slice(0, 20).map((t) => ctx(dot(`\`${cut(t.name, 30)}\``,
      t.pr ? `PR ${link(t.pr.url, `#${t.pr.number}`)}` : t.out === 'pr' ? 'no PR yet' : 'ships as a diff', t.pr && pill(t.pr.state),
      t.pr?.ci && `CI ${cut(t.pr.ci, 20)}`, Number.isFinite(t.changes) && `${t.changes} file${t.changes === 1 ? '' : 's'} changed`)))
      .concat(/^[UW][A-Z0-9]+$/.test(d.owner ?? '') ? [ctx(`<@${d.owner}>`)] : [])
      : [ctx(dot(p && `PR ${link(url, `#${p.number}`)}`, p && pill(p.state), p?.ci && `CI ${cut(p.ci, 20)}`, /^[UW][A-Z0-9]+$/.test(d.owner ?? '') && `<@${d.owner}>`) || '-')]),
    // Interrupt and Stop only while it runs (live): on a paused or PR-open session they do nothing.
    ...actions([btn('Diff', 'diff', d.key), ...(d.live === false ? [] : [btn('Interrupt', 'interrupt', d.key), btn('Stop', 'stop', d.key, { style: 'danger',
      confirm: { title: pt('Stop the session?'), text: pt('The sandbox stops. The branch stays.'), confirm: pt('Stop'), deny: pt('Keep') } })])])],
    fallback: null,
  };
}

function _sessions(d) {
  const rows = (d.rows ?? []).slice(0, 49);
  const owner = (r) => (/^[UW][A-Z0-9]+$/.test(r.owner ?? '') ? ` · <@${r.owner}>` : '');
  const line = (r) => { const url = safeUrl(r.url); return `${url ? link(url, cut(r.task, 80)) : cut(r.task, 80)} · ${pill(r.state)} · ${num(r.minutes)} min${owner(r)}`; };
  return {
    text: plain(`${rows.length} live session${rows.length === 1 ? '' : 's'}.`),
    blocks: [ctx(`*${rows.length} live session${rows.length === 1 ? '' : 's'}*`), sec(rows.map(line).join('\n').slice(0, 3000) || 'None')],
    fallback: null,
  };
}

function _end(d) {
  const p = d.pr, head = sec(`*Session ended.*${d.reason ? ` ${cut(d.reason, 200)}` : ''}`);
  // Unknown turns or changes are left out, never shown as 0. No feedback buttons until something handles them.
  const line = dot(d.minutes != null && `${num(d.minutes)} min`, d.turns != null && `${num(d.turns)} turns`,
    p ? `PR ${link(p.url, `#${p.number}`)} ${pill(p.state)}` : d.files != null && (d.files ? 'branch not pushed' : 'no change'));
  // Slack refuses a context block with no elements, and then the whole card.
  const blocks = line ? [head, ctx(line)] : [head];
  const said = [d.minutes != null && `${num(d.minutes)} min`, d.turns != null && `${num(d.turns)} turns`, p && `PR #${p.number} ${p.state ?? ''}`.trim()].filter(Boolean);
  return {
    text: plain(`Session ended.${said.length ? ` ${said.join(', ')}.` : ''}`),
    blocks,
    fallback: blocks,
  };
}

// Operators only. Notes are short fixed strings from ctl: no hostnames, no error text.
function _bot(d) {
  const svc = d.services ?? [], down = svc.filter((s) => s.state !== 'up');
  const head = ctx(dot(`*${cut(d.name ?? 'fxa-agent', 40)}*`, d.version && cut(d.version, 30), d.uptime && `up ${cut(d.uptime, 20)}`));
  return {
    text: plain(down.length ? `${down.length} of ${svc.length} services are not up: ${down.map((s) => s.name).join(', ')}.` : `All ${svc.length} services are up.`),
    blocks: [head, sec([...down.map((s) => `⚠ *${cut(s.name, 40)}* ${cut(s.state, 20)}${s.note ? ` · ${cut(s.note, 60)}` : ''}`),
      `✓ ${svc.filter((s) => s.state === 'up').map((s) => `${cut(s.name, 40)}${s.note ? ` (${cut(s.note, 60)})` : ''}`).join(', ') || 'nothing up'}`].join('\n'))],
    fallback: [head, sec(svc.map((s) => `${pill(s.state)} ${cut(s.name, 40)}${s.note ? ` · ${cut(s.note, 60)}` : ''}`).join('\n') || 'No services')],
  };
}

// Every builder sees its data cleaned once: no string can carry Slack markup (a link, a mention),
// whichever field a builder puts where. URL fields stay as they are: safeUrl checks them.
const clean = (v, k) => (typeof v === 'string' ? (/url|permalink|^href$/i.test(k ?? '') ? v : defuse(v).replace(/</g, '‹').replace(/>/g, '›'))
  : Array.isArray(v) ? v.map((x) => clean(x, k)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, clean(x, kk)])) : v);
const RAW = { pr: _pr, turn: _turn, tools: _tools, jira: _jira, sentry: _sentry, ci: _ci, review: _review, tests: _tests, deploy: _deploy, grafana: _grafana, status: _status, sessions: _sessions, end: _end, bot: _bot };
export const BUILDERS = Object.fromEntries(Object.entries(RAW).map(([k, f]) => [k, (d) => f(clean(d))]));
export const { pr, turn, tools, jira, sentry, ci, review, tests, deploy, grafana, status, sessions, end, bot } = BUILDERS;

// The thread's PR card, from the controller's pr-status (session_pr_status) for one session.
// Open is its only button: the PR notes keep their own buttons, which carry the reviewer and repo.
export function prFromStatus(cur, { key, repo } = {}) {
  if (!cur?.url) return null;
  const people = (st) => (cur.reviews ?? []).filter((r) => r.state === st && !isCopilot(r.login)).map((r) => r.login);
  const c = pr({ key, repo, url: cur.url, number: Number(String(cur.url).match(/\/pull\/(\d+)$/)?.[1]) || 0,
    state: cur.state === 'MERGED' ? 'merged' : cur.state === 'CLOSED' ? 'closed' : 'open', draft: cur.draft,
    ci: cur.ci === 'running' ? 'pending' : cur.ci, failing: cur.failing, mergeable: cur.mergeable, jira: cur.jira,
    approvers: people('APPROVED'), changers: people('CHANGES_REQUESTED') });
  const open = (b) => (b?.type === 'button' ? b.action_id === 'wo_open' : true);
  const strip = (bl) => bl.map((b) => (b.type === 'card' ? { ...b, actions: (b.actions ?? []).filter(open) }
    : b.type === 'actions' ? { ...b, elements: b.elements.filter(open) } : b)).filter((b) => b.type !== 'actions' || b.elements.length);
  return { text: c.text, blocks: strip(c.blocks), fallback: strip(c.fallback) };
}

// Agent card protocol: a fenced ```fxa-card {"kind","ref"}``` block. Only kind and ref are read.
const REPO = () => (process.env.PIPE_REPO_SLUG || 'mozilla/fxa').replace(/[.]/g, '\\.');
const REF = {
  pr: (r) => /^\d{1,7}$/.test(r) || new RegExp(`^https://github\\.com/${REPO()}/pull/\\d{1,7}$`).test(r),
  jira: (r) => /^FXA-\d{1,6}$/.test(r),
  sentry: (r) => /^\d{1,20}$|^[A-Z0-9-]{3,40}$/.test(r),
  ci: (r) => /^\d{1,7}$/.test(r),
  deploy: (r) => /^fxa-[a-z0-9-]{1,50}$|^\*$/.test(r),
  grafana: (r) => /^[A-Za-z0-9_-]{1,40}\/\d{1,4}$/.test(r),
};
const CHARTS = new Set(['sentry', 'grafana']);
const FENCE = /^[ \t]*```fxa-card[ \t]*\n?([\s\S]*?)```[ \t]*(\n|$)/gm;
export function parseAgentCards(text) {
  const cards = [], seen = new Set();
  const out = String(text ?? '').replace(FENCE, (_, body) => {
    if (Buffer.byteLength(body) > 500) return '';
    let j; try { j = JSON.parse(body); } catch { return ''; }
    const kind = j?.kind, ref = typeof j?.ref === 'string' ? j.ref.trim() : '';
    if (!Object.hasOwn(REF, kind) || !REF[kind](ref) || seen.has(`${kind}:${ref}`) || cards.length >= 3) return '';
    if (CHARTS.has(kind) && (cards.filter((c) => CHARTS.has(c.kind)).length >= 2 || (kind === 'grafana' && cards.some((c) => c.kind === 'grafana')))) return '';
    seen.add(`${kind}:${ref}`); cards.push({ kind, ref });
    return '';
  });
  return { text: out.replace(/\n{3,}/g, '\n\n').trim(), cards };
}
