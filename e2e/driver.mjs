// Plays a scenario's steps into the bot as Slack events, and waits on the fake Slack, not on sleeps.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOT, toText } from './slack-view.mjs';
import { stepChecks, globalChecks } from './asserts.mjs';

export const CHANNEL = 'C_TEST';
const ADVANCE = { setup: 5, turn: 10, finish: 12 }; // fake-ctl.sh: setup 5 s, a turn 10 s, a wrap-up 12 s
const SETTLE_MS = 1500; // longer than the bot's 1.2 s live-edit throttle
const TIMEOUT_MS = 20_000;
const uid = (p) => `U${p}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, what, ms = TIMEOUT_MS) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (pred()) return; await sleep(100); }
  throw new Error(`timed out after ${ms / 1000}s waiting for ${typeof what === 'function' ? what() : what}`);
}

// "@bot" and "@B" become Slack's <@U…> mentions.
const mentions = (text, people) => text.replace(/@(\w+)/g, (all, n) => (n === 'bot' ? `<@${BOT.user_id}>` : n in people ? `<@${uid(n)}>` : all));
const label = (t) => (typeof t === 'string' ? t : t?.text ?? '');
const matches = (want, s) => (want instanceof RegExp ? want.test(s) : s === want);

const envelope = (event) => ({ type: 'event_callback', team_id: BOT.team_id, api_app_id: 'A_E2E', event_id: `Ev${String(event.event_ts).replace('.', '')}${event.type.length}${event.subtype ?? ''}`,
  event_time: Math.floor(Date.now() / 1000), event, authorizations: [{ team_id: BOT.team_id, user_id: BOT.user_id, is_bot: true }] });

// The interactive elements of a message: buttons and selects, with their block.
const elements = (m) => (m.blocks ?? []).flatMap((b, bi) => [...(b.elements ?? []), ...(b.accessory ? [b.accessory] : [])].map((e) => ({ e, b, bi })))
  .filter(({ e }) => e.action_id);

export async function runScenario(app, view, scenario) {
  const out = process.env.E2E_OUT, nowFile = process.env.FAKE_NOW_FILE, ctlFile = process.env.FAKE_CTL_LOG;
  const order = process.env.E2E_ORDER || 'message_first';
  const roots = {}, notes = [], failures = [], xfail = [], fixed = [], said = [], stepSeq = [];
  let lastTap = null;
  const send = (body) => app.processEvent({ body, ack: async () => {} }).catch((e) => { console.error(`event handler threw: ${e.stack ?? e.message}`); });
  // Quiet for SETTLE_MS, counted from the step's start too: an advance gives the bot's 1 s poll time to see it.
  let stepAt = Date.now();
  const settled = () => until(() => Math.min(view.quietFor(), Date.now() - stepAt) >= SETTLE_MS, 'the bot to go quiet');
  const ctlLines = () => (existsSync(ctlFile) ? readFileSync(ctlFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const inThread = (m, t) => (m.thread_ts ?? m.ts) === roots[t];

  // A step's target message: 'root', 'last' (the person's last), 'self' (this step's), 'last:B', 'status' (newest bot post), or a seq.
  function target(on, person, t) {
    if (typeof on === 'number') return view.msgs.find((m) => m.seq === on);
    if (on === 'root') return view.msgs.find((m) => m.ts === roots[t]);
    if (on === 'status') return view.msgs.filter((m) => m.bot && !m.to && inThread(m, t)).at(-1);
    const who = on.startsWith('last:') ? uid(on.slice(5)) : uid(person);
    return said.filter((m) => m.user === who && (on === 'self' ? m.step === said.at(-1)?.step : true)).at(-1);
  }

  function tapBody(person, m, e, b, extra = {}) {
    return { type: 'block_actions', user: { id: uid(person), username: person, name: person, team_id: BOT.team_id }, api_app_id: 'A_E2E', token: 'fake',
      container: { type: 'message', message_ts: m.ts, channel_id: CHANNEL, is_ephemeral: Boolean(m.to), thread_ts: m.thread_ts },
      trigger_id: 'trig', team: { id: BOT.team_id, domain: 'fake' }, enterprise: null, is_enterprise_install: false, channel: { id: CHANNEL, name: 'test' },
      ...(m.to ? {} : { message: { type: 'message', ts: m.ts, thread_ts: m.thread_ts, text: m.text, blocks: m.blocks, user: BOT.user_id, bot_id: BOT.bot_id } }),
      state: { values: {} }, response_url: 'https://fake.slack.com/respond',
      actions: [{ type: e.type, action_id: e.action_id, block_id: b.block_id ?? `b${m.seq}`, action_ts: String(Date.now() / 1000), ...(e.text ? { text: e.text } : {}), ...(e.value !== undefined ? { value: e.value } : {}), ...extra }] };
  }

  async function act(person, a, t, i) {
    const p = uid(person), root = roots[t];
    if (typeof a === 'string') {
      const text = mentions(a, scenario.people);
      const m = view.personSays(p, CHANNEL, text, root);
      m.step = i;
      if (!root) roots[t] = m.ts;
      said.push(m);
      // Slack sends a tagged message twice: as a message and as an app_mention.
      const ev = { type: 'message', channel: CHANNEL, channel_type: 'channel', user: p, text, ts: m.ts, event_ts: m.ts, ...(root ? { thread_ts: root } : {}) };
      const evs = text.includes(`<@${BOT.user_id}>`) ? [ev, { ...ev, type: 'app_mention' }] : [ev];
      if ((a.order ?? order) === 'mention_first') evs.reverse();
      for (const e of evs) send(envelope(e));
      return `${person} says`;
    }
    if (a.tap !== undefined || a.pick !== undefined) {
      const want = a.tap ?? a.pick;
      // on: 'same' taps the message as it was at the last tap, as a quick double tap does.
      const cands = (a.on === 'same' && lastTap ? [lastTap] : view.msgs.filter((m) => !m.deleted && m.bot && visibleTo(m, p) && inThread(m, t)).reverse());
      for (const m of cands) {
        let els = elements(m);
        if (a.q !== undefined) els = els.filter(({ bi }) => bi === [...new Set(els.map((x) => x.bi))][a.q]);
        for (const { e, b } of els) {
          if (a.tap !== undefined && e.type === 'button' && (matches(want, label(e.text)) || e.action_id === want)) {
            lastTap = { ...m, blocks: structuredClone(m.blocks) }; send(tapBody(person, m, e, b)); return `${person} taps "${label(e.text)}" on #${m.seq}`;
          }
          if (a.pick !== undefined && e.options) {
            const picks = [want].flat().map((w) => e.options.find((o) => matches(w, label(o.text)) || o.value === w));
            if (picks.every(Boolean)) {
              lastTap = { ...m, blocks: structuredClone(m.blocks) };
              send(tapBody(person, m, e, b, e.type.startsWith('multi_') ? { selected_options: picks } : { selected_option: picks[0] }));
              return `${person} picks ${picks.map((o) => `"${label(o.text)}"`).join(', ')} on #${m.seq}`;
            }
          }
        }
      }
      throw new Error(`${person} sees no ${a.tap !== undefined ? 'button' : 'option'} ${want}`);
    }
    if (a.edit !== undefined) {
      const m = target(a.edit, person, t), text = mentions(a.text, scenario.people), before = m.text;
      view.personEdit(m, text);
      const ets = `${Math.floor(Date.now() / 1000)}.${String(Date.now() % 1000).padStart(6, '0')}`;
      send(envelope({ type: 'message', subtype: 'message_changed', hidden: true, channel: CHANNEL, ts: ets, event_ts: ets,
        message: { type: 'message', user: p, text, ts: m.ts, ...(m.thread_ts ? { thread_ts: m.thread_ts } : {}), edited: { user: p, ts: ets } },
        previous_message: { type: 'message', user: p, text: before, ts: m.ts, ...(m.thread_ts ? { thread_ts: m.thread_ts } : {}) } }));
      return `${person} edits #${m.seq}`;
    }
    if (a.del !== undefined) {
      const m = target(a.del, person, t), ets = String(Date.now() / 1000);
      view.personDelete(m);
      const prev = { type: 'message', user: m.user, text: m.text, ts: m.ts, ...(m.thread_ts ? { thread_ts: m.thread_ts } : {}) };
      // A root with replies stays as a tombstone; anything else is deleted.
      const hasReplies = !m.thread_ts && view.msgs.some((x) => x.thread_ts === m.ts);
      send(envelope(hasReplies
        ? { type: 'message', subtype: 'message_changed', hidden: true, channel: CHANNEL, ts: ets, event_ts: ets, message: { type: 'message', subtype: 'tombstone', text: 'This message was deleted.', ts: m.ts, user: 'USLACKBOT' }, previous_message: prev }
        : { type: 'message', subtype: 'message_deleted', hidden: true, channel: CHANNEL, ts: ets, event_ts: ets, deleted_ts: m.ts, previous_message: prev }));
      return `${person} deletes #${m.seq}`;
    }
    if (a.react !== undefined) {
      const m = target(a.on ?? 'status', person, t), ets = String(Date.now() / 1000);
      view.personReact(m, p, a.react);
      send(envelope({ type: 'reaction_added', user: p, reaction: a.react, item: { type: 'message', channel: CHANNEL, ts: m.ts }, item_user: m.bot ? BOT.user_id : m.user, event_ts: ets }));
      return `${person} reacts :${a.react}: on #${m.seq}`;
    }
    throw new Error(`unknown action ${JSON.stringify(a)}`);
  }
  const visibleTo = (m, u) => !m.to || m.to === u;

  // only: {STEER: ['owner']} keeps a step for those matrix variants.
  const keep = (step) => Object.entries(step.only ?? {}).every(([k, vals]) => vals.includes(k === 'order' ? order : process.env[k]));
  for (const [i, step] of scenario.steps.entries()) {
    if (!keep(step)) continue;
    const snap = { chg: view.chg(), seq: Math.max(0, ...view.msgs.map((m) => m.seq)), ctl: ctlLines().length };
    const person = Object.keys(step).find((k) => k in scenario.people), t = step.thread ?? 'T1';
    stepAt = Date.now();
    try {
      if (step.advance !== undefined) {
        const s = ADVANCE[step.advance] ?? Number(step.advance);
        writeFileSync(nowFile, String(Number(readFileSync(nowFile, 'utf8')) + s));
        notes.push({ t, seq: snap.seq + 0.5, text: `[advance ${step.advance}]` });
      }
      if (person) {
        const what = await act(person, step[person], t, i);
        if (typeof step[person] !== 'string') notes.push({ t, seq: snap.seq + 0.5, text: `[${what}]` });
      }
      const w = step.wait ?? 'settled';
      if (w === 'turn_end') {
        // A turn ended: a ✅ or ⚠️ landed in this step, and no message still has 👀 (⏳ waits for a later turn).
        const from = view.calls.length;
        const waiting = () => view.msgs.filter((m) => !m.bot && !m.deleted && m.reactions.has('eyes') && !m.reactions.has('hourglass_flowing_sand'));
        // A turn with no new message to answer ends without a reaction: then its stream stops, or its line shows the reply.
        const ended = (c) => (c.method === 'reactions.add' && ['white_check_mark', 'warning'].includes(c.args.name)) || c.method === 'chat.stopStream'
          || (c.method === 'chat.update' && /Fake turn \d+/.test(`${c.args.text} ${JSON.stringify(c.args.blocks ?? '')}`));
        await until(() => view.calls.slice(from).some(ended) && !waiting().length,
          () => `a turn to end (✅ or ⚠️, and no 👀 left${waiting().length ? `; waiting: #${waiting().map((m) => m.seq).join(', #')}` : ''})`);
      } else if (w.text) {
        await until(() => view.msgs.some((m) => m.bot && w.text.test(`${m.text} ${JSON.stringify(m.blocks ?? '')}`)), `a bot message matching ${w.text}`);
      } else if (w.buttons) {
        await until(() => view.msgs.some((m) => m.bot && elements(m).some(({ e }) => w.buttons.test(label(e.text)))), `a button matching ${w.buttons}`);
      }
      await settled();
      for (let s = snap.seq + 1; s <= Math.max(0, ...view.msgs.map((m) => m.seq)); s++) stepSeq[s] = i;
      const bad = step.expect ? stepChecks(step.expect, { view, snap, ctl: ctlLines(), roots, target: (on) => target(on, person, t) }) : [];
      if (bad.length && step.known) xfail.push(`step ${i + 1} (${step.known}): ${bad.join('; ')}`);
      else if (bad.length) failures.push(...bad.map((b) => `step ${i + 1}: expected ${b}`));
      else if (step.known) fixed.push(`step ${i + 1}: passes now; remove known "${step.known}"`);
    } catch (e) {
      failures.push(`step ${i + 1}: ${e.message}`);
      break;
    }
  }

  const botLog = existsSync(join(out, 'bot.log')) ? readFileSync(join(out, 'bot.log'), 'utf8') : '';
  const global = globalChecks({ view, botLog, stepOf: (seq) => stepSeq[seq] ?? -1 });
  for (const [id, list] of Object.entries(global)) {
    if (!list) { if (scenario.known?.[id]) fixed.push(`${id}: passes now; remove known "${scenario.known[id]}"`); continue; }
    (scenario.known?.[id] ? xfail : failures).push(`${id}${scenario.known?.[id] ? ` (${scenario.known[id]})` : ''}: ${list.join('; ')}`);
  }

  const thread = Object.entries(roots).map(([t, ts]) => `${Object.keys(roots).length > 1 ? `== ${t}\n` : ''}${toText(view, { channel: CHANNEL, thread_ts: ts, who: (u) => u?.replace(/^U/, ''), notes: notes.filter((n) => n.t === t) })}`).join('\n\n');
  writeFileSync(join(out, 'thread.txt'), `${thread}\n`);
  writeFileSync(join(out, 'calls.jsonl'), view.calls.map((c) => JSON.stringify(c)).join('\n'));
  writeFileSync(join(out, 'result.json'), JSON.stringify({ ok: failures.length === 0, failures, xfail, fixed }, null, 2));
  return failures.length === 0;
}
