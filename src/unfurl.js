// Work Object cards for links the bot knows: a watch link shows its thread's session,
// a Jira link its ticket, a Sentry link its issue. Pure: app.js fetches them and posts the card.

const TASK = 'slack#/entities/task';
const INCIDENT = 'slack#/entities/incident';
const STATE_COLOR = { active: 'blue', starting: 'blue', wrapping: 'blue', queued: 'gray', paused: 'yellow',
  pr_open: 'green', answered: 'green', stopped: 'gray', failed: 'red' };
const CATEGORY_COLOR = { new: 'gray', indeterminate: 'blue', done: 'green' };
const ISSUE_STATUS = { unresolved: ['Unresolved', 'red'], resolved: ['Resolved', 'green'], ignored: ['Ignored', 'gray'] };
const LEVEL_COLOR = { fatal: 'red', error: 'red', warning: 'yellow', info: 'blue', debug: 'gray' };

const host = (u) => { try { return new URL(u).host; } catch { return ''; } };
// The product logos (assets/), public so Slack can fetch them; WO_ICON_BASE moves them.
const ICONS = process.env.WO_ICON_BASE || 'https://raw.githubusercontent.com/vbudhram/fxa-agent-bot/main/assets';
const icon = (base, name, alt) => ({ url: `${base}/${name}.png`, alt_text: alt });

// The links a card can be made for: { kind: 'watch', url, channel, ts }, { kind: 'jira', url, key }
// or { kind: 'sentry', url, ref } (an issue id or short id), or { kind: 'pr', url, number } on github (owner/repo).
export function parseLinks(urls, { gateway, jira, sentry, github }) {
  const out = [];
  for (const url of urls) {
    let u; try { u = new URL(url); } catch { continue; }
    let m;
    if (gateway && u.host === host(gateway) && (m = u.pathname.match(/^\/w\/([A-Z0-9]+):(\d+\.\d+)\/?$/))) {
      out.push({ kind: 'watch', url, channel: m[1], ts: m[2] });
    } else if (jira && u.host === host(jira) && (m = u.pathname.match(/^\/browse\/(FXA-\d+)\/?$/))) {
      out.push({ kind: 'jira', url, key: m[1] });
    } else if (sentry && u.host === host(sentry) && (m = u.pathname.match(/^\/issues\/(\d+|[A-Z0-9]+(?:-[A-Z0-9]+)+)\/?$/i))) {
      out.push({ kind: 'sentry', url, ref: m[1] });
    } else if (github && u.host === 'github.com' && u.pathname.toLowerCase().startsWith(`/${github.toLowerCase()}/pull/`)
      && (m = u.pathname.match(/\/pull\/(\d+)(?:\/[a-z]*)?\/?$/))) {
      out.push({ kind: 'pr', url, number: m[1], repo: github });
    }
  }
  return out;
}

const firstLine = (t) => (String(t ?? '').split('\n').find((l) => l.trim()) ?? '').trim().slice(0, 120);

// The card's payload: shown in the message, and again in the details panel.
export function watchPayload(link, s) {
  if (!s) {
    return { attributes: { title: { text: 'Agent thread' }, display_type: 'Agent session', product_name: 'fxa-agent' },
      fields: { status: { value: 'no session', tag_color: 'gray' } } };
  }
  const fields = { status: { value: String(s.state ?? 'unknown').replace('_', ' '), tag_color: STATE_COLOR[s.state] ?? 'gray' } };
  const now = firstLine(s.status_text ?? s.last_act);
  if (now) fields.description = { value: now, format: 'markdown' };
  if (s.owner) fields.assignee = { user: { user_id: s.owner }, type: 'slack#/types/user' };
  if (s.started_at) fields.date_created = { value: Math.floor(s.started_at / 1000) };
  return { attributes: { title: { text: firstLine(s.prompt) || 'Agent session' }, display_id: s.key, display_type: 'Agent session',
    product_name: 'fxa-agent' }, fields };
}

export function jiraPayload(card, icons = ICONS) {
  const fields = { status: { value: card.status ?? 'unknown', tag_color: CATEGORY_COLOR[card.category] ?? 'gray' } };
  if (card.assignee) fields.assignee = { user: { text: card.assignee }, type: 'slack#/types/user' };
  if (card.priority && !/^\(?none\)?$/i.test(card.priority)) fields.priority = { value: card.priority };
  return { attributes: { title: { text: card.summary ?? card.key }, display_id: card.key, display_type: card.type ?? 'Ticket',
    product_name: 'Jira', product_icon: icon(icons, 'jira', 'Jira') }, fields };
}

const unix = (iso) => (iso ? Math.floor(Date.parse(iso) / 1000) : undefined);

// A Sentry issue as a compact incident: how bad, how big, how recent, and a button that sends the agent.
// Two columns, few rows: Slack clips a tall card. The level is a tagged custom field: severity does not show.
export function sentryPayload(card, icons = ICONS) {
  const [status, color] = ISSUE_STATUS[card.status] ?? [String(card.status ?? 'unknown'), 'gray'];
  const n = (v) => Number(v ?? 0).toLocaleString('en-US');
  const fields = { status: { value: status, tag_color: color }, service: { value: card.project ?? 'unknown' } };
  if (card.lastSeen) fields.date_updated = { value: unix(card.lastSeen), type: 'slack#/types/timestamp' };
  if (card.culprit) fields.description = { value: card.culprit };
  const day = (card.hourly ?? []).slice(-24), total = day.reduce((a, b) => a + b, 0);
  const custom = [
    { key: 'level', label: 'Level', value: card.level ?? 'unknown', type: 'string', tag_color: LEVEL_COLOR[card.level] ?? 'gray' },
    { key: 'impact', label: 'Impact', value: `${n(card.count)} events · ${n(card.userCount)} users`, type: 'string' },
    { key: 'day', label: 'Last 24 h', value: total ? `${n(total)} events · peak ${n(Math.max(...day))} an hour` : 'No events', type: 'string' },
  ];
  return {
    attributes: { title: { text: firstLine(card.title) || card.shortId }, display_id: card.shortId, display_type: 'Issue',
      product_name: 'Sentry', product_icon: icon(icons, 'sentry', 'Sentry') },
    fields, custom_fields: custom,
    display_order: ['status', 'level', 'date_updated', 'service', 'description', 'impact', 'day'],
    actions: { primary_actions: [
      { text: 'Investigate', action_id: 'wo_investigate', value: card.shortId, style: 'primary' },
      { text: 'Open in Sentry', action_id: 'wo_open', url: card.permalink },
    ] },
  };
}

const PR_STATE = { OPEN: ['Open', 'green'], MERGED: ['Merged', 'blue'], CLOSED: ['Closed', 'red'] };
const who = (names) => names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');

// A pull request: its state, CI and reviews at a glance, and an Investigate button when CI fails.
export function prPayload(pr, icons = ICONS) {
  const n = (v) => Number(v ?? 0).toLocaleString('en-US');
  const [state, color] = pr.draft && pr.state === 'OPEN' ? ['Draft', 'gray'] : PR_STATE[pr.state] ?? [String(pr.state ?? 'unknown'), 'gray'];
  const ci = { pass: [`Passing · ${n(pr.checks)} checks`, 'green'], none: ['No checks', 'gray'],
    fail: [`Failing · ${n(pr.failed)} of ${n(pr.checks)}${pr.failing?.length ? `: ${pr.failing.join(', ')}` : ''}`, 'red'],
    running: [`Running · ${n(pr.running)} of ${n(pr.checks)} left`, 'yellow'] }[pr.ci] ?? ['Unknown', 'gray'];
  const review = pr.changers?.length ? [`Changes requested by ${who(pr.changers)}`, 'red']
    : pr.review === 'APPROVED' ? [pr.approvers?.length ? `Approved by ${who(pr.approvers)}` : 'Approved', 'green']
      : pr.review === 'REVIEW_REQUIRED' ? ['Review required', 'yellow'] : ['No review needed', 'gray'];
  const fields = { status: { value: state, tag_color: color } };
  if (pr.author) fields.assignee = { user: { text: pr.author }, type: 'slack#/types/user' };
  if (pr.updated) fields.date_updated = { value: unix(pr.updated), type: 'slack#/types/timestamp' };
  const custom = [
    { key: 'ci', label: 'CI', value: ci[0], type: 'string', tag_color: ci[1] },
    { key: 'review', label: 'Reviews', value: review[0], type: 'string', tag_color: review[1] },
    { key: 'size', label: 'Size', value: `+${n(pr.additions)} −${n(pr.deletions)} · ${n(pr.files)} files`, type: 'string' },
    ...(pr.jira ? [{ key: 'jira', label: 'Jira', value: pr.jira, type: 'string' }] : []),
  ];
  return {
    attributes: { title: { text: firstLine(pr.title) || `#${pr.number}` }, display_id: `#${pr.number}`, display_type: 'Pull request',
      product_name: 'GitHub', product_icon: icon(icons, 'github', 'GitHub') },
    fields, custom_fields: custom,
    display_order: ['status', 'assignee', 'ci', 'review', 'size', 'date_updated', 'jira'],
    actions: { primary_actions: [
      ...(pr.ci === 'fail' && pr.state === 'OPEN' ? [{ text: 'Investigate CI', action_id: 'wo_investigate', value: `pr:${pr.number}`, style: 'primary' }] : []),
      { text: 'Open on GitHub', action_id: 'wo_open', url: pr.url },
    ] },
  };
}

// One entity for chat.unfurl's metadata.
export const entity = (link, payload) => ({
  app_unfurl_url: link.url, url: link.url,
  external_ref: link.kind === 'watch' ? { id: `${link.channel}:${link.ts}`, type: 'watch' }
    : link.kind === 'sentry' ? { id: link.id ?? link.ref, type: 'sentry' }
      : link.kind === 'pr' ? { id: `${link.repo}#${link.number}`, type: 'github_pr' } : { id: link.key, type: 'jira' },
  entity_type: link.kind === 'sentry' ? INCIDENT : TASK, entity_payload: payload,
});

export { TASK, INCIDENT };
