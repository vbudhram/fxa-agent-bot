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
// or { kind: 'sentry', url, ref } (an issue id or short id).
export function parseLinks(urls, { gateway, jira, sentry }) {
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

// One entity for chat.unfurl's metadata.
export const entity = (link, payload) => ({
  app_unfurl_url: link.url, url: link.url,
  external_ref: link.kind === 'watch' ? { id: `${link.channel}:${link.ts}`, type: 'watch' }
    : link.kind === 'sentry' ? { id: link.id ?? link.ref, type: 'sentry' } : { id: link.key, type: 'jira' },
  entity_type: link.kind === 'sentry' ? INCIDENT : TASK, entity_payload: payload,
});

export { TASK, INCIDENT };
