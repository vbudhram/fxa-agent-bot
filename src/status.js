// The live status message every member of the thread sees: Slack's plan block (its agent
// checklist) in a normal message the bot edits, with a task per kind of work. A stream would
// show it to one person only.
export const PLAN_MAX = 50; // Slack keeps at most 50 tasks in a plan
const count = /^(.*?) · (\d+) steps?$/;
const STATUS = { '✓': 'complete', '›': 'in_progress', '▸': 'in_progress', '○': 'pending' };

function earlier(rows) {
  const old = rows.map((r) => r.replace(/^[✓›▸○] /, ''));
  const n = old.reduce((a, r) => a + Number(r.match(count)?.[2] ?? 0), 0);
  return `✓ Earlier · ${old.map((r) => r.match(count)?.[1] ?? r).join(', ').slice(0, 80)}${n ? ` · ${n} steps` : ''}`;
}
// rows: "✓ done", "› current", "○ open". Past PLAN_MAX the oldest fold into one Earlier task.
// Slack draws a done task and an open one with the same dot, so a done title starts with ✓.
export function planTasks(rows) {
  const keep = rows.length > PLAN_MAX ? [earlier(rows.slice(0, rows.length - PLAN_MAX + 1)), ...rows.slice(rows.length - PLAN_MAX + 1)] : rows;
  return keep.map((r, i) => {
    const status = STATUS[r[0]] ?? 'complete', title = r.replace(/^[✓›▸○] /, '');
    return { task_id: `t${i}`, title: `${status === 'complete' ? '✓ ' : ''}${title}`.slice(0, 150), status };
  });
}

// With no rows yet (in line, the first second of setup) the status is its title alone.
// id: one block_id for the message's whole life. A new one on an edit closes a plan someone opened.
export function statusMessage({ title, rows = [], id = 'status' }) {
  const text = [title, ...rows].join('\n');
  if (!rows.length) return { text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: title } }] };
  return { text, blocks: [{ type: 'plan', block_id: `plan-${id}`.slice(0, 255), title: title.slice(0, 150), tasks: planTasks(rows) }] };
}
