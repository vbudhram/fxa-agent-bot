// The live status of one turn, built from the watch's events: the agent's todo
// list, the files it edited, its subagents, and test, lint and type-check
// counts. Pure functions; app.js sends what they return. Nothing here is saved.
import { defuse, stage } from './render.js';

export const MAX_ROWS = 40; // Slack keeps 50 rows per message and drops the rest silently

export const start = () => ({ todos: null, files: {}, subagents: {}, tests: null, lint: null, types: null });

export function reduce(st, ev) {
  switch (ev?.type) {
    case 'todos':
      return { ...st, todos: (ev.items ?? []).map((t) => ({ content: String(t.content ?? ''), status: String(t.status ?? 'pending'), active: String(t.active ?? '') })) };
    case 'edit': {
      if (!ev.file) return st;
      const f = st.files[ev.file] ?? { added: 0, removed: 0 };
      return { ...st, files: { ...st.files, [ev.file]: { added: f.added + (Number(ev.added) || 0), removed: f.removed + (Number(ev.removed) || 0) } } };
    }
    case 'subagent_start':
      return { ...st, subagents: { ...st.subagents, [ev.id]: { agent: String(ev.agent ?? ''), description: String(ev.description ?? ''), done: false } } };
    case 'tool_done':
      return st.subagents[ev.id] ? { ...st, subagents: { ...st.subagents, [ev.id]: { ...st.subagents[ev.id], done: true } } } : st;
    case 'tests': case 'lint': case 'types':
      return { ...st, [ev.type]: ev };
    default:
      return st;
  }
}

const STATUS = { completed: 'complete', in_progress: 'in_progress' };
const clip = (t) => defuse(t).replace(/\s+/g, ' ').trim().slice(0, 250);

// The todo list as checklist rows, ids d0, d1, ...; a long list ends in one "more" row.
export function todoRows(st) {
  const todos = st.todos ?? [];
  const rows = todos.map((t, i) => ({ id: `d${i}`, title: clip(t.status === 'in_progress' && t.active ? t.active : t.content), status: STATUS[t.status] ?? 'pending' }));
  if (rows.length <= MAX_ROWS) return rows;
  const rest = rows.slice(MAX_ROWS - 1);
  return [...rows.slice(0, MAX_ROWS - 1), { id: `d${MAX_ROWS - 1}`, title: `… ${rest.length} more`, status: rest.every((r) => r.status === 'complete') ? 'complete' : 'pending' }];
}

// The row a step's detail line belongs under: the todo in progress, else the last open one.
export function currentRow(rows) {
  return (rows.find((r) => r.status === 'in_progress') ?? rows.find((r) => r.status !== 'complete') ?? rows.at(-1))?.id ?? null;
}

// The rows whose title or status changed since `sent` ({id: "title|status"}).
export function changedRows(sent, rows) {
  const next = { ...sent }, out = [];
  for (const r of rows) {
    const k = `${r.title}|${r.status}`;
    if (next[r.id] !== k) { out.push(r); next[r.id] = k; }
  }
  return { rows: out, sent: next };
}

// One line of facts: files, tests, lint and type errors. Empty when there are none.
export function facts(st) {
  const bits = [], files = Object.values(st.files);
  if (files.length) {
    const a = files.reduce((n, f) => n + f.added, 0), r = files.reduce((n, f) => n + f.removed, 0);
    bits.push(`${files.length} file${files.length === 1 ? '' : 's'} (+${a} −${r})`);
  }
  if (st.tests) bits.push(st.tests.failed ? `tests ${st.tests.passed} passed, ${st.tests.failed} failed` : `tests ${st.tests.passed} passed`);
  if (st.lint?.errors) bits.push(`lint ${st.lint.errors} error${st.lint.errors === 1 ? '' : 's'}`);
  if (st.types?.errors) bits.push(`types ${st.types.errors} error${st.types.errors === 1 ? '' : 's'}`);
  const running = Object.values(st.subagents).filter((s) => !s.done);
  if (running.length === 1) bits.push(`${running[0].agent ? defuse(running[0].agent) : 'a subagent'} working`);
  else if (running.length) bits.push(`${running.length} subagents working`);
  return bits.join(' · ');
}

// The finished turn, for its summary line: "3/4 todos · 2 files (+52 −11) · tests 44 passed".
export function summary(st) {
  const todos = st.todos ?? [];
  const done = todos.filter((t) => t.status === 'completed').length;
  const bits = [...(todos.length ? [`${done}/${todos.length} todos`] : []), facts({ ...st, subagents: {} })].filter(Boolean);
  return bits.join(' · ');
}

// The finished turn's checklist, compact: every todo with its mark.
export const todoLine = (st) => (st.todos ?? []).length
  ? todoRows(st).map((r) => `${r.status === 'complete' ? '✓' : '○'} ${r.title}`).join('  ·  ') : null;

// The finished turn's second line, under the summary (which has the counts): the todos while
// any is open, else the kinds of work when there were several. stages: row labels, in order.
export function closingLine(st, stages = []) {
  const todos = st?.todos ?? [];
  if (todos.length) return todos.some((t) => t.status !== 'completed') ? todoLine(st) : null;
  const kinds = [...new Set(stages.map((r) => String(r).replace(/ · \d+( steps?)?$/, '')))];
  return kinds.length > 1 ? kinds.map((k) => `✓ ${defuse(k)}`).join('  ·  ') : null;
}

// After Slack closes a turn's stream, the turn goes on as an edited line with the same rows
// the stream showed, not raw commands. rows: {rows_done, cur_kind, cur_label, cur_count} as
// the stream left them; each new step joins its stage row or opens the next one.
const steps = (n) => `${n} step${n === 1 ? '' : 's'}`;
export function advanceRows(rows, news) {
  let { rows_done: done = [], cur_kind: kind = null, cur_label: label = null, cur_count: count = 0 } = rows ?? {};
  done = [...(done ?? [])];
  for (const step of news) {
    const st = stage(step) ?? (kind ? { kind, label } : { kind: 'explore', label: 'Exploring the code' });
    if (st.kind !== kind) {
      if (count) done.push(`${label} · ${steps(count)}`);
      kind = st.kind; label = st.label; count = 1;
    } else count += 1;
  }
  return { rows_done: done, cur_kind: kind, cur_label: label, cur_count: count };
}
// The line's body: the todos when there are any, else the stage rows; the running one is marked ›.
export function lineRows(st, rows) {
  const todos = todoRows(st ?? start());
  if (todos.length) { const cur = currentRow(todos); return todos.map((r) => `${r.status === 'complete' ? '✓' : r.id === cur ? '›' : '○'} ${r.title}`); }
  return [...(rows?.rows_done ?? []).map((r) => `✓ ${defuse(r)}`), ...(rows?.cur_count ? [`› ${defuse(rows.cur_label)} · ${steps(rows.cur_count)}`] : [])];
}

// A short "how is it going" message. While a turn runs the bot answers it from
// this state at once; queued for the agent it waited until the turn ended.
// Every sentence must be a status ask: "what's happening with CI? rerun it" is a real message.
const STATUS_ASKS = [/^(what'?s|what is)( the)? (status|progress|eta)( here| now)?$/i, /^(what'?s|what is) (up|happening|going on)( here| now)?$/i,
  /^(status|progress|eta|updates?|any updates?)$/i, /^how'?s it going$/i, /^how is it going$/i, /^where (are )?we( at)?$/i];
export const isStatusAsk = (text) => {
  const t = String(text ?? '').trim().replace(/^(hey|hi|so|ok|okay)[,!]?\s+/i, '');
  const parts = t.split(/[?!.]+\s*/).map((p) => p.trim()).filter(Boolean);
  return t.length <= 60 && parts.length > 0 && parts.every((p) => STATUS_ASKS.some((r) => r.test(p)));
};

// The status reply: time, todo progress, the current todo, the last step and when it started.
export function statusReply(st, { elapsedMs = 0, lastStep = '', stepAgoMs = 0, said = '' } = {}) {
  const m = (ms) => `${Math.max(0, Math.round(ms / 60_000))}m`;
  const rows = todoRows(st), cur = rows.find((r) => r.id === currentRow(rows));
  const done = rows.filter((r) => r.status === 'complete').length;
  const head = [`⏳ Still working · ${m(elapsedMs)}`, ...(rows.length ? [`${done}/${rows.length} todos`] : []), facts(st)].filter(Boolean).join(' · ');
  const note = clip(said).split(/(?<=[.!?])\s+/).filter(Boolean).at(-1) ?? '';
  return [head,
    ...(cur && cur.status !== 'complete' ? [`› Now: ${cur.title}`] : []),
    ...(lastStep ? [`› Last step, ${m(stepAgoMs)} ago: \`${clip(lastStep).replace(/`/g, "'").slice(0, 120)}\``] : []),
    ...(note ? [`› Last note: _${note.replace(/_/g, ' ')}_`] : []),
  ].join('\n');
}
