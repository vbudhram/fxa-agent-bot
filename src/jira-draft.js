// Jira tickets from a session (the controller's FXA_JIRA_DRAFTS). The agent drafts; a person files.
// A clear request from a person files at once with Undo; anything else shows the draft card first.
import { defuse } from './render.js';

// A request that names a ticket, in the person's own words: "file a ticket", "make a Jira for this".
export const JIRA_ASK = /\b(?:file|create|open|make|raise|log|add)\b[^.?!\n]{0,30}\b(?:jira|ticket|bug report|issue)\b/i;
// The quoted thread lines and others' text that voice() adds never count: only the person's own text.
export const asksForJira = (text) => JIRA_ASK.test(String(text ?? ''));

// Text in a code block, escaped: no markup, mention or hidden link can render, and the card shows what Jira gets.
const code = (t) => `\`\`\`${String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/```/g, "'''") || ' '}\`\`\``;
const esc = (t) => defuse(String(t ?? '')).replace(/[<>&*_~`]/g, ' ').replace(/\s+/g, ' ').trim();
const btn = (text, action_id, value, style) => ({ type: 'button', text: { type: 'plain_text', text }, action_id, value, ...(style ? { style } : {}) });
const dupLine = (dups, jiraUrl) => (dups?.length
  ? `Maybe the same: ${dups.map((d) => `${jiraUrl ? `<${jiraUrl}/browse/${d.key}|${d.key}>` : d.key} ${esc(d.summary).slice(0, 80)}`).join(' · ')}`
  : null);
const PRIVATE_NOTE = (p) => `:lock: This thread is private. Everyone who can read ${p} in Jira can read the ticket.`;

// draftCard(d, key, { privateChannel, jiraUrl })   d is the controller's frozen draft.
export function draftCard(d, key, { privateChannel = false, jiraUrl = '' } = {}) {
  const v = `${key}|${d.sha}`;
  const notes = [dupLine(d.dups, jiraUrl), privateChannel ? PRIVATE_NOTE(d.project) : null].filter(Boolean);
  return {
    text: `Jira draft for ${d.project}: ${esc(d.summary)}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `:memo: *Jira draft* · ${d.project} · ${d.type}\n*${esc(d.summary)}*` } },
      { type: 'section', text: { type: 'mrkdwn', text: code(d.description) } },
      ...(notes.length ? [{ type: 'context', elements: notes.map((t) => ({ type: 'mrkdwn', text: t })) }] : []),
      { type: 'actions', elements: [btn(`Create in ${d.project}`, 'jira_create', v, 'primary'), btn('Create and queue for ai-fixme', 'jira_create_fixme', v),
        btn('Edit', 'jira_edit', v), btn('Discard', 'jira_discard', v)] },
    ],
  };
}

// filedCard(f)   f: {key, ticket, project, summary, by, fixme, dups, privateChannel, jiraUrl, undo}. undo: false once it is too late.
export function filedCard(f) {
  const link = f.jiraUrl ? `<${f.jiraUrl}/browse/${f.ticket}|${f.ticket}>` : f.ticket;
  const v = `${f.key}|${f.ticket}|${f.by}`;
  const notes = [dupLine(f.dups, f.jiraUrl), f.privateChannel ? PRIVATE_NOTE(f.project) : null].filter(Boolean);
  return {
    text: `Filed ${f.ticket}: ${esc(f.summary)}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `:white_check_mark: Filed ${link} by <@${f.by}>${f.fixme ? ', queued for ai-fixme' : ''}\n${esc(f.summary)}` } },
      ...(notes.length ? [{ type: 'context', elements: notes.map((t) => ({ type: 'mrkdwn', text: t })) }] : []),
      { type: 'actions', elements: [...(f.undo === false ? [] : [btn('Undo', 'jira_undo', v)]), btn('Edit', 'jira_edit_filed', v),
        ...(f.fixme ? [] : [btn('Queue for ai-fixme', 'jira_queue', v)])] },
    ],
  };
}

// The Edit form. meta goes back on submit: {key, sha | ticket, channel, ts}.
export function editModal(d, meta) {
  const input = (block_id, label, element) => ({ type: 'input', block_id, label: { type: 'plain_text', text: label }, element: { action_id: 'v', ...element } });
  const opt = (t) => ({ text: { type: 'plain_text', text: t }, value: t });
  return {
    type: 'modal', callback_id: 'jira_edit_submit', private_metadata: JSON.stringify(meta),
    title: { type: 'plain_text', text: meta.ticket ? `Edit ${meta.ticket}` : 'Edit the Jira draft' },
    submit: { type: 'plain_text', text: 'Save' },
    blocks: [
      input('type', 'Type', { type: 'static_select', options: ['Task', 'Bug', 'Story'].map(opt), initial_option: opt(['Task', 'Bug', 'Story'].includes(d.type) ? d.type : 'Task') }),
      input('summary', 'Summary', { type: 'plain_text_input', max_length: 200, initial_value: String(d.summary ?? '').slice(0, 200) }),
      input('description', 'Description', { type: 'plain_text_input', multiline: true, max_length: 2800, initial_value: String(d.description ?? '').slice(0, 2800) }),
    ],
  };
}

// The submitted form's values as a draft.
export const readEdit = (values) => ({ type: values.type?.v?.selected_option?.value ?? 'Task',
  summary: values.summary?.v?.value ?? '', description: values.description?.v?.value ?? '' });
