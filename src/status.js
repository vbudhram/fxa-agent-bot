// The live status message every member of the thread sees: Slack's plan block (its agent
// checklist) in a normal message the bot edits, with a task per kind of work and the current
// command under the running one. A stream would show it to one person only.
export const PLAN_MAX = 50; // Slack keeps at most 50 tasks in a plan
const CMD_MAX = 90;
const count = /^(.*?) · (\d+) steps?$/;
const STATUS = { '✓': 'complete', '›': 'in_progress', '▸': 'in_progress', '○': 'pending' };

function earlier(rows) {
  const old = rows.map((r) => r.replace(/^[✓›▸○] /, ''));
  const n = old.reduce((a, r) => a + Number(r.match(count)?.[2] ?? 0), 0);
  return `✓ Earlier · ${old.map((r) => r.match(count)?.[1] ?? r).join(', ').slice(0, 80)}${n ? ` · ${n} steps` : ''}`;
}
// rows: "✓ done", "› current", "○ open". Past PLAN_MAX the oldest fold into one Earlier task.
export function planTasks(rows, cmd) {
  const keep = rows.length > PLAN_MAX ? [earlier(rows.slice(0, rows.length - PLAN_MAX + 1)), ...rows.slice(rows.length - PLAN_MAX + 1)] : rows;
  return keep.map((r, i) => {
    const status = STATUS[r[0]] ?? 'complete', title = r.replace(/^[✓›▸○] /, '').slice(0, 150);
    const run = status === 'in_progress' && cmd;
    return { task_id: `t${i}`, title, status, ...(run ? { details: { type: 'rich_text', elements: [{ type: 'rich_text_section',
      elements: [{ type: 'text', text: String(cmd).replace(/\s+/g, ' ').slice(0, CMD_MAX), style: { code: true } }] }] } } : {}) };
  });
}

// With no rows yet (in line, the first second of setup) the status is its title alone.
// Slack asks for a new block_id on each edit of a plan.
export function statusMessage({ title, rows = [], cmd }) {
  const text = [title, ...rows].join('\n');
  if (!rows.length) return { text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: title } }] };
  const block_id = `plan-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { text, blocks: [{ type: 'plan', block_id, title: title.slice(0, 150), tasks: planTasks(rows, cmd) }] };
}
