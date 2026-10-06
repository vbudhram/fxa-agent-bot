// Work Object cards for links the bot knows: a watch link shows its thread's session,
// a Jira link its ticket. Pure: app.js fetches the session or ticket and posts the card.

const TASK = 'slack#/entities/task';
const STATE_COLOR = { active: 'blue', starting: 'blue', wrapping: 'blue', queued: 'gray', paused: 'yellow',
  pr_open: 'green', answered: 'green', stopped: 'gray', failed: 'red' };
const CATEGORY_COLOR = { new: 'gray', indeterminate: 'blue', done: 'green' };

const host = (u) => { try { return new URL(u).host; } catch { return ''; } };

// The links a card can be made for: { kind: 'watch', url, channel, ts } or { kind: 'jira', url, key }.
export function parseLinks(urls, { gateway, jira }) {
  const out = [];
  for (const url of urls) {
    let u; try { u = new URL(url); } catch { continue; }
    let m;
    if (gateway && u.host === host(gateway) && (m = u.pathname.match(/^\/w\/([A-Z0-9]+):(\d+\.\d+)\/?$/))) {
      out.push({ kind: 'watch', url, channel: m[1], ts: m[2] });
    } else if (jira && u.host === host(jira) && (m = u.pathname.match(/^\/browse\/(FXA-\d+)\/?$/))) {
      out.push({ kind: 'jira', url, key: m[1] });
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

export function jiraPayload(card) {
  const fields = { status: { value: card.status ?? 'unknown', tag_color: CATEGORY_COLOR[card.category] ?? 'gray' } };
  if (card.assignee) fields.assignee = { user: { text: card.assignee }, type: 'slack#/types/user' };
  if (card.priority) fields.priority = { value: card.priority };
  return { attributes: { title: { text: card.summary ?? card.key }, display_id: card.key, display_type: card.type ?? 'Ticket',
    product_name: 'Jira' }, fields };
}

// One entity for chat.unfurl's metadata.
export const entity = (link, payload) => ({
  app_unfurl_url: link.url, url: link.url,
  external_ref: link.kind === 'watch' ? { id: `${link.channel}:${link.ts}`, type: 'watch' } : { id: link.key, type: 'jira' },
  entity_type: TASK, entity_payload: payload,
});

export { TASK };
