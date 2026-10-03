// Quick answers: a read-only look at main before any sandbox. The agent asks for
// a sandbox itself (an upgrade) when the request needs changes, tests or a push;
// a request that plainly asks for that work skips the look.
import { md } from './render.js';

// Only the request is matched, not the thread context the bot appends to it.
const WORK = /\b(?:fix|implement|refactor|rebase|push|open (?:a |the )?(?:pr|pull request)|create (?:a |the )?(?:pr|pull request)|run (?:the |all )?(?:\w+ )?tests?|record|video|screenshot|install|deploy|reproduce|repro|sandbox|build (?:a|an|the|me))\b/i;
const request = (prompt) => (prompt ?? '').split('\n\nEarlier messages')[0];

export const quickFirst = (prompt, { resuming = false, runtime = 'claude', on = true } = {}) =>
  on && !resuming && runtime === 'claude' && !WORK.test(request(prompt));

export const askId = (key) => `ask-${String(key).replace(/^agent-/, '')}`;

const note = (text) => ({ type: 'context', elements: [{ type: 'mrkdwn', text }] });

export const answerBlocks = (res) => [md(res.answer),
  note(`Quick answer from a read-only look at main, in ${res.secs} s. Tag me again to go further. If it needs code changes or tests, I start a sandbox.`)];

export const upgradeText = (u) => `This needs a sandbox: ${String(u?.reason ?? '').replace(/\s+$/, '').replace(/([^.!?])$/, '$1.')} Starting one now, with what I found so far.`;

export const upgradeBlocks = (res) => [...(res.answer ? [md(res.answer)] : []), note(upgradeText(res.upgrade))];

// What the session gets from the quick look: the findings, then the answer so far.
export const findingsOf = (res) => [res.upgrade?.findings, res.answer && `Its reply so far:\n${res.answer}`].filter(Boolean).join('\n\n');
