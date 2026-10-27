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
    // The runner's git diff, every 15 s: the real count, also for edits made with a script.
    case 'diffstat':
      return { ...st, files: Object.fromEntries((ev.files ?? []).map((f) => [String(f.file), { added: Number(f.added) || 0, removed: Number(f.removed) || 0 }])) };
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
// The same line only when a todo is still open: a turn that finished its list says nothing more.
export const openTodoLine = (st) => (st?.todos ?? []).some((t) => t.status !== 'completed') ? todoLine(st) : null;

// The status's stage rows, not raw commands: one row per stage, with its time. rows: {rows_done:
// [{kind, ms}], cur_kind, cur_label, cur_count, cur_since} as the last update left them.
export const clock = (ms) => { const t = Math.max(0, Math.round(ms / 1000)); return t < 60 ? `${t}s` : `${Math.floor(t / 60)}m`; };
const PAST = { explore: 'Explored the code', edit: 'Made the change', verify: 'Verified', review: 'Reviewed' };
export function advanceRows(rows, news, now = Date.now()) {
  let { rows_done: done = [], cur_kind: kind = null, cur_label: label = null, cur_count: count = 0, cur_since: since = now } = rows ?? {};
  done = (done ?? []).filter((r) => r?.kind); // a record from before this layout held strings
  for (const step of news) {
    const st = stage(step) ?? (kind ? { kind, label } : { kind: 'explore', label: 'Exploring the code' });
    if (st.kind !== kind) {
      if (count) done = done.some((r) => r.kind === kind) ? done.map((r) => (r.kind === kind ? { ...r, ms: r.ms + now - since } : r)) : [...done, { kind, ms: now - since }];
      kind = st.kind; label = st.label; count = 1; since = now;
    } else count += 1;
  }
  return { rows_done: done, cur_kind: kind, cur_label: label, cur_count: count, cur_since: since };
}
// The line's body: the todos when there are any, else the stage rows, the running one last and marked ›.
// The running row shows whole minutes only, so the clock alone never changes the rows.
export function lineRows(st, rows, now = Date.now()) {
  const todos = todoRows(st ?? start());
  if (todos.length) { const cur = currentRow(todos); return todos.map((r) => `${r.status === 'complete' ? '✓' : r.id === cur ? '›' : '○'} ${r.title}`); }
  const done = (rows?.rows_done ?? []).filter((r) => r?.kind);
  const cur = rows?.cur_count ? (done.find((r) => r.kind === rows.cur_kind)?.ms ?? 0) + now - (rows.cur_since ?? now) : 0;
  return [...done.filter((r) => !rows?.cur_count || r.kind !== rows.cur_kind).map((r) => `✓ ${PAST[r.kind] ?? r.kind} · ${clock(r.ms)}`),
    ...(rows?.cur_count ? [`› ${defuse(rows.cur_label)}${cur >= 60_000 ? ` · ${clock(cur)}` : ''}`] : [])];
}
// The agent's latest note for the status title: the first whole sentence of its newest text block.
export function note(said) {
  // No < > &: the plan title is plain text, so an escaped &lt; would show as it is.
  const t = String(said ?? '').replace(/[*_`#<>&]/g, '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  if (!m) return '';
  const s = defuse(m[1]).replace(/\.$/, '');
  return s.length > 70 ? `${s.slice(0, 70).replace(/\s+\S*$/, '')}…` : s;
}
// What the collapsed status says the agent does now: thinking for a while, its recent note, else the running todo or stage.
export const NOTE_MS = 180_000, THINK_MS = 20_000;
export function headline(st, rows, { said = '', saidAgoMs = Infinity, thinkMs = 0 } = {}) {
  if (thinkMs >= THINK_MS) return 'Thinking';
  const n = saidAgoMs < NOTE_MS ? note(said) : '';
  if (n) return n;
  const todos = todoRows(st ?? start()), cur = todos.find((r) => r.id === currentRow(todos));
  if (cur) return cur.status === 'complete' ? 'Finishing up' : cur.title;
  return rows?.cur_count ? defuse(rows.cur_label) : null;
}
// "step 5 of 6" while the agent has a todo list, for the status title; else nothing.
export function progress(st) {
  const todos = st?.todos ?? [];
  return todos.length ? `step ${Math.min(todos.filter((t) => t.status === 'completed').length + 1, todos.length)} of ${todos.length}` : null;
}

// Lost contact: the polls of a running turn keep failing. One warning after LOST_MS, a
// recovery when a poll works again, and one give-up after GIVE_UP_MS. st: {since, warned,
// gave_up} or null; returns the next st and what to show: 'warn', 'recover', 'give_up' or null.
// The e2e sets them shorter; the give-up message says 10 minutes, the default.
export const LOST_MS = Number(process.env.LOST_MS) || 60_000, GIVE_UP_MS = Number(process.env.GIVE_UP_MS) || 600_000;
export function lostContact(st, ok, now) {
  if (ok) return { st: null, show: st?.warned && !st.gave_up ? 'recover' : null };
  const cur = st ?? { since: now, warned: false, gave_up: false };
  if (!cur.gave_up && now - cur.since >= GIVE_UP_MS) return { st: { ...cur, warned: true, gave_up: true }, show: 'give_up' };
  if (!cur.warned && now - cur.since >= LOST_MS) return { st: { ...cur, warned: true }, show: 'warn' };
  return { st: cur, show: null };
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

// The last sentence of the agent's latest text block: the status reply's note.
export const lastNote = (said) => clip(said ?? '').split(/(?<=[.!?])\s+/).filter(Boolean).at(-1) ?? '';

// The status reply: time, todo progress, the current todo, the last step and when it started.
export function statusReply(st, { elapsedMs = 0, lastStep = '', stepAgoMs = 0, said = '' } = {}) {
  const m = (ms) => `${Math.max(0, Math.round(ms / 60_000))}m`;
  const rows = todoRows(st), cur = rows.find((r) => r.id === currentRow(rows));
  const done = rows.filter((r) => r.status === 'complete').length;
  const head = [`⏳ Still working · ${m(elapsedMs)}`, ...(rows.length ? [`${done}/${rows.length} todos`] : []), facts(st)].filter(Boolean).join(' · ');
  const note = lastNote(said);
  return [head,
    ...(cur && cur.status !== 'complete' ? [`› Now: ${cur.title}`] : []),
    ...(lastStep ? [`› Last step, ${m(stepAgoMs)} ago: \`${clip(lastStep).replace(/`/g, "'").slice(0, 120)}\``] : []),
    ...(note ? [`› Last note: _${note.replace(/_/g, ' ')}_`] : []),
  ].join('\n');
}
