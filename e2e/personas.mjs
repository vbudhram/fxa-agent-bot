// Claude personas: each person in a cast is a cheap model with a brief. Every round each one
// sees the thread as they would (their own ephemerals only) and picks one action, all at once,
// as people do. The driver plays the actions as normal steps and records them for replay.
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blockText, toText } from './slack-view.mjs';

const MODEL = process.env.FXA_E2E_PERSONA_MODEL || 'claude-haiku-5-5';
const ROUNDS = Number(process.env.E2E_PERSONA_ROUNDS || 12);

export const CASTS = {
  'busy-team': {
    title: 'An owner, an impatient teammate, and an outsider',
    opening: { A: '@bot the verify code input loses focus on blur, can you fix it?' },
    people: {
      A: { desc: 'owner, allowed', brief: 'You asked for the fix. You answer questions, steer once if the bot drifts, and when the work looks done you open a PR. You stop talking once the PR is up.' },
      B: { desc: 'teammate, allowed', brief: 'A teammate who is impatient. You have opinions about the fix and share them, sometimes without tagging the bot, sometimes tagging it. You may tap buttons you see.' },
      C: { desc: 'not allowed', brief: 'Someone from another team who wandered into the thread. You are curious, ask the bot things, and try a command or two.' },
    },
    judge: 'People get clear, private answers about what they can do. Only A ships. Nothing C says starts work.',
  },
  'button-masher': {
    title: 'An owner, and a teammate who taps everything',
    opening: { A: '@bot add a test for the password strength meter' },
    people: {
      A: { desc: 'owner, allowed', brief: 'You asked for the test. You read what the bot says and reply when it asks. When it is done, push the branch.' },
      B: { desc: 'teammate, allowed', brief: 'You tap every button you can see, and you react with 👎 when you do not like a reply. You rarely type.' },
    },
    judge: 'B\'s taps never ship or stop A\'s work, and each refusal says why. The thread stays readable.',
  },
  'stop-and-go': {
    title: 'An owner who pauses, stops and resumes, with a teammate',
    opening: { A: '@bot rename the recovery key setting label to match the new copy' },
    people: {
      A: { desc: 'owner, allowed', brief: 'You change your mind: you pause or stop the work once (!pause, !stop), then continue it with a reply or a tag. You may edit one of your own messages.' },
      B: { desc: 'teammate, allowed', brief: 'You try to help: you tag the bot with a correction once, and you try a command such as !status or !pause.' },
    },
    judge: 'After each pause or stop everyone knows the state. A resume picks up the work once, not twice.',
  },
};

const SCHEMA = JSON.stringify({ type: 'object', required: ['action', 'why'], properties: {
  action: { enum: ['say', 'edit', 'delete', 'tap', 'react', 'wait'] },
  text: { type: 'string', description: 'say/edit: the message. Write @bot to tag the bot, @A to tag A.' },
  msg: { type: 'integer', description: 'edit/delete/tap/react: the #number of the message' },
  label: { type: 'string', description: 'tap: the button label, exactly as shown' },
  emoji: { enum: ['-1', '+1', 'eyes'], description: 'react' },
  why: { type: 'string', description: 'one short line, for the test log' },
} });

function ask(prompt) {
  const t = mkdtempSync(join(tmpdir(), 'fxa-persona-'));
  return new Promise((resolve) => {
    const c = execFile('claude', ['-p', '--model', MODEL, '--output-format', 'json', '--json-schema', SCHEMA, '--tools', '', '--setting-sources', 'project', '--no-session-persistence'],
      // The bot runs with a scratch HOME; the claude CLI needs the real one, and USER, for its login.
      { cwd: t, timeout: 120_000, maxBuffer: 5 * 1024 * 1024, env: { ...process.env, HOME: process.env.E2E_REAL_HOME ?? process.env.HOME } }, (err, stdout, stderr) => {
        rmSync(t, { recursive: true, force: true });
        if (err) console.error(`persona model: ${err.message.slice(0, 200)} ${String(stderr).slice(0, 300)} ${String(stdout).match(/"result":"[^"]{0,300}/)?.[0] ?? ''}`);
        try { resolve(err ? { action: 'wait', why: `model error: ${err.message.slice(0, 80)}` } : JSON.parse(stdout).structured_output ?? { action: 'wait', why: 'no answer' }); }
        catch { resolve({ action: 'wait', why: 'unreadable answer' }); }
      });
    c.stdin.end(prompt);
  });
}

// What person p sees and may do now.
function seenBy(ctx, p) {
  const u = `U${p}`, root = ctx.roots.T1;
  const thread = toText(ctx.view, { channel: ctx.channel, thread_ts: root, who: ctx.who, viewer: u });
  const taps = ctx.view.msgs.filter((m) => m.bot && !m.deleted && (!m.to || m.to === u) && (m.thread_ts ?? m.ts) === root)
    .map((m) => [m.seq, blockText(m.blocks).buttons]).filter(([, b]) => b.length).map(([s, b]) => `#${s}: ${b.map((x) => `[${x}]`).join(' ')}`);
  const mine = ctx.view.msgs.filter((m) => m.user === u && !m.deleted).map((m) => `#${m.seq}`);
  return { thread, taps, mine };
}

function personaPrompt(cast, p, seen, round, log) {
  const others = Object.entries(cast.people).filter(([q]) => q !== p).map(([q, d]) => `${q} (${d.desc})`).join(', ');
  return [
    `You play ${p}, a person in a Slack thread at Mozilla, in a test of a Slack bot called fxa-agent (@bot). Others here: ${others}.`,
    `Who you are: ${cast.people[p].desc}. ${cast.people[p].brief}`,
    'Act like a real person in Slack: short messages, natural, sometimes terse. Do not narrate. Do not mention that this is a test.',
    'Pick exactly one action for this moment. "wait" is fine and common: people do not reply to everything.',
    `Round ${round} of ${ROUNDS}. Time moves about 5 seconds between rounds; a bot turn takes about 10 seconds.`,
    log.length ? `What you did so far:\n${log.map((l) => `- ${l}`).join('\n')}` : 'You have not acted yet.',
    `\nThe thread as you see it ("ephemeral -> ${p}" is visible to you only; [..] lines are notes from the test harness):\n${seen.thread}`,
    seen.taps.length ? `\nButtons you can tap:\n${seen.taps.join('\n')}` : '\nNo buttons are visible to you.',
    seen.mine.length ? `\nYour own messages (you may edit or delete them): ${seen.mine.join(', ')}` : '',
  ].join('\n');
}

const toStep = (p, d) => ({
  say: () => d.text && { [p]: d.text },
  edit: () => d.msg && d.text && { [p]: { edit: d.msg, text: d.text } },
  delete: () => d.msg && { [p]: { del: d.msg } },
  tap: () => d.label && { [p]: { tap: d.label, ...(d.msg ? { on: d.msg } : {}) } },
  react: () => d.msg && { [p]: { react: d.emoji ?? '+1', on: d.msg } },
}[d.action]?.() ?? null);

// A scenario whose steps the personas decide. seed: which person acts first in each round.
export function personaScenario(name, seed = 1) {
  const cast = CASTS[name];
  return {
    title: `${name} #${seed}: ${cast.title}`,
    people: Object.fromEntries(Object.entries(cast.people).map(([p, d]) => [p, d.desc])),
    judge: cast.judge,
    async *steps(ctx) {
      yield cast.opening;
      yield { advance: 'setup' };
      const logs = Object.fromEntries(Object.keys(cast.people).map((p) => [p, []]));
      for (let r = 1; r <= ROUNDS; r++) {
        const ps = Object.keys(cast.people);
        const decided = await Promise.all(ps.map((p) => ask(personaPrompt(cast, p, seenBy(ctx, p), r, logs[p]))));
        const order = ps.map((p, k) => [p, decided[k]]);
        for (let k = 0; k < (seed + r) % order.length; k++) order.push(order.shift());
        for (const [p, d] of order) {
          logs[p].push(`round ${r}: ${d.action}${d.text ? ` "${d.text}"` : ''}${d.label ? ` [${d.label}]` : ''}${d.msg ? ` on #${d.msg}` : ''}`);
          const step = toStep(p, d);
          if (step) yield { ...step, soft: true, why: d.why };
        }
        yield { advance: 5 };
      }
      // Let the last turn and any wrap-up finish, so the end state is settled.
      yield { advance: 'turn' };
      yield { advance: 'finish' };
    },
  };
}
