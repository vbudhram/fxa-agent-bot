// Quick answers: the agent first looks at main without a sandbox, and asks for
// one itself (an upgrade) when the request needs changes, tests or a push. A
// request that plainly asks for that work skips the look. The person sees one
// bot: the same card, the same status rows and the same summary either way.
import { md, stage, phase } from './render.js';

// Only the request is matched, not the thread context the bot appends to it.
const WORK = /\b(?:fix|implement|refactor|rebase|push|open (?:a |the )?(?:pr|pull request)|create (?:a |the )?(?:pr|pull request)|run (?:the |all )?(?:\w+ )?tests?|record|video|screenshot|install|deploy|reproduce|repro|sandbox|build (?:a|an|the|me))\b/i;
const request = (prompt) => (prompt ?? '').split('\n\nEarlier messages')[0];

export const quickFirst = (prompt, { resuming = false, runtime = 'claude', on = true } = {}) =>
  on && !resuming && runtime === 'claude' && !WORK.test(request(prompt));

export const askId = (key) => `ask-${String(key).replace(/^agent-/, '')}`;

// A slip about the mode never reaches the thread: a sentence about limits, hand-offs or
// "a sandbox" goes (outside code blocks). An iframe's sandbox attribute is not a slip.
const MODE = /\b(?:read[- ]only|from here|hand(?:ing)? (?:it |this |that )?off|hand-?off|(?:a|the|my|your) sandbox|(?:can(?:no|')t|cannot|unable to) (?:run|write|edit|change|modify|push|open|execute|test|record|take|make)|(?:don'?t|do not) have (?:access|the ability|write))\b/i;
export function seamless(text) {
  let code = false;
  return String(text ?? '').split('\n').map((line) => {
    if (/^\s*```/.test(line)) { code = !code; return line; }
    if (code || !MODE.test(line)) return line;
    const kept = line.split(/(?<=[.!?])\s+/).filter((s) => !MODE.test(s)).join(' ');
    return /^\s*([-*•]|\d+\.)\s*$/.test(kept) ? '' : kept;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// The reply, as a sandbox turn's reply looks: the text, nothing about how it was made.
export const answerBlocks = (res) => [md(res.answer)];

// What the session gets from the quick look: the findings, then the reply so far.
export const findingsOf = (res) => [res.upgrade?.findings, res.answer && `Its reply so far:\n${res.answer}`].filter(Boolean).join('\n\n');

// The card and the first status row, the same for both paths.
export const ON_IT = 'On it! The status below shows each step and how long it took.';
export const FIRST_ROW = 'Working on it';

const row = (t, title, status, details) => ({ type: 'task_update', id: `t${t}`, title: String(title).slice(0, 250),
  ...(details ? { details: String(details).slice(0, 250) } : {}), status });
export const stepCount = (n) => `${n} step${n === 1 ? '' : 's'}`;
export const rowTitle = (st) => (st.count ? `${st.label} · ${stepCount(st.count)}` : st.label);

// stepRows(st, step): the checklist rows a sandbox turn shows, for steps that come one
// at a time: a new row when the stage changes (the last one ticks), else a count.
// st: {t, kind, label, count}; start from {t: 0, kind: null, label: FIRST_ROW, count: 0}.
export function stepRows(st, text) {
  const g = stage(text), detail = phase(text).detail || text;
  if (g && g.kind !== st.kind) {
    const next = { t: st.t + 1, kind: g.kind, label: g.label, count: 1 };
    return { st: next, chunks: [row(st.t, rowTitle(st), 'complete'), row(next.t, rowTitle(next), 'in_progress', detail)] };
  }
  const next = { ...st, count: st.count + 1 };
  return { st: next, chunks: [row(st.t, rowTitle(next), 'in_progress', detail)] };
}
export const lastRow = (st) => row(st.t, rowTitle(st), 'complete');

const secs = (ms) => { const t = Math.round(ms / 1000); return t < 60 ? `${t}s` : `${Math.floor(t / 60)}m ${t % 60}s`; };
// The summary line a sandbox turn ends with.
export const doneLine = (word, n, tookMs, askedMs) =>
  `${word} · ${n ? `${stepCount(n)} · ` : ''}${secs(tookMs)}${askedMs ? ` · reply ${secs(askedMs)} after your message` : ''}`;
