// Hard checks: per step (a step's expect) and global (every scenario). No model time.
import { blockText } from './slack-view.mjs';

const uid = (p) => `U${p}`;
const said = (m) => { const { lines } = blockText(m.blocks); return [m.text, ...lines, ...(m.chunks ?? []).map((c) => c.title ?? c.text ?? '')].join('\n'); };
const visibleTo = (m, u) => !m.to || m.to === u;
const ids = (m) => (m.blocks ?? []).flatMap((b) => [...(b.elements ?? []), ...(b.accessory ? [b.accessory] : [])]).map((e) => e.action_id).filter(Boolean);

// ctx: {view, snap: {chg, seq, ctl}, ctl: [lines], roots: {T1: ts}}
export function stepChecks(expect = {}, ctx) {
  const { view, snap, ctl, roots } = ctx;
  const inStep = view.msgs.filter((m) => m.seq > snap.seq);
  const touched = view.msgs.filter((m) => m.chg > snap.chg);
  const ctlStep = ctl.slice(snap.ctl);
  const cmdOf = (l) => l.argv.find((a) => !a.startsWith('--') && !/^(gce|fxa|pyfxa-team|monitor)$/.test(a));
  const ctlMatch = (l, c) => (!c.cmd || cmdOf(l) === c.cmd) && (!c.match || c.match.test(JSON.stringify([l.argv, l.files]).replace(/\\n/g, '\n')))
    && (!c.thread || JSON.stringify(l.argv).includes(roots[c.thread]));
  const bad = [];
  const need = (ok, msg) => { if (!ok) bad.push(msg); };
  const norm = (x) => (typeof x === 'string' ? { cmd: x } : x);
  for (const [k, v] of Object.entries(expect)) {
    if (k === 'ephemeral') need(inStep.some((m) => m.to === uid(v.to) && (!v.match || v.match.test(said(m)))), `an ephemeral to ${v.to}${v.match ? ` matching ${v.match}` : ''}`);
    else if (k === 'ephemeralCount') need(view.msgs.filter((m) => m.to === uid(v.to)).length === v.n, `${v.n} ephemeral(s) to ${v.to} in all, saw ${view.msgs.filter((m) => m.to === uid(v.to)).length}`);
    else if (k === 'noEphemeral') need(!inStep.some((m) => m.to === uid(v)), `no ephemeral to ${v}`);
    else if (k === 'ctl') { const c = norm(v), n = c.n !== undefined ? ctl.filter((l) => ctlMatch(l, c)).length : ctlStep.filter((l) => ctlMatch(l, c)).length;
      need(c.n !== undefined ? n === c.n : n > 0, `controller call ${JSON.stringify({ ...c, match: c.match?.toString() })}${c.n !== undefined ? `, saw ${n}` : ''}`); }
    else if (k === 'noCtl') { const c = norm(v); need(!ctlStep.some((l) => ctlMatch(l, c)), `no controller call ${JSON.stringify({ ...c, match: c.match?.toString() })}`); }
    else if (k === 'reaction') { const m = ctx.target(v.on ?? 'self');
      need(m && m.reactions.has(v.name) && (!v.not || !m.reactions.has(v.not)), `:${v.name}:${v.not ? ` and not :${v.not}:` : ''} on ${v.on ?? 'self'}, saw ${m ? [...m.reactions].join(',') || 'none' : 'no message'}`); }
    else if (k === 'noReaction') { const m = ctx.target(v.on ?? 'self'); need(m && !m.reactions.has(v.name), `no :${v.name}: on ${v.on ?? 'self'}`); }
    else if (k === 'edited') need(touched.some((m) => m.bot && m.edits && (!v.match || v.match.test(said(m)))), `an edited bot message${v.match ? ` matching ${v.match}` : ''}`);
    else if (k === 'text') need(touched.some((m) => m.bot && !m.to && v.test(said(m))), `a bot message matching ${v}`);
    else if (k === 'noText') need(!touched.some((m) => m.bot && v.test(said(m))), `no bot message matching ${v}`);
    else if (k === 'noPublicPost') need(!inStep.some((m) => m.bot && !m.to), 'no new public bot message');
    else if (k === 'noButtonsLeft') need(!view.msgs.some((m) => !m.deleted && ids(m).some((i) => v.test ? v.test(i) : /^answer_/.test(i))), 'no buttons left');
    else if (k === 'postCount') { const n = view.msgs.filter((m) => m.bot && !m.to && !m.deleted && (!v.thread || (m.thread_ts ?? m.ts) === roots[v.thread]) && v.match.test(said(m))).length;
      need(n === v.n, `${v.n} public bot message(s) matching ${v.match}${v.thread ? ` in ${v.thread}` : ''}, saw ${n}`); }
    else bad.push(`unknown expect "${k}"`);
  }
  return bad;
}

// Global invariants. stepOf: message seq -> step index, for "in one step" checks.
export function globalChecks({ view, botLog, stepOf }) {
  const out = {};
  const bot = view.msgs.filter((m) => m.bot && !m.deleted);
  const person = view.msgs.filter((m) => !m.bot && !m.deleted);
  const fail = (id, list) => { out[id] = list.length ? list.slice(0, 5) : null; };
  fail('reacted', person.filter((m) => m.reactions.has('eyes') || m.reactions.has('hourglass_flowing_sand')).map((m) => `#${m.seq} still has ${[...m.reactions].join(',')}`));
  fail('no_control_lines', bot.filter((m) => /^(status:|OPTION:|QUESTION:)/m.test(said(m))).map((m) => `#${m.seq}`));
  fail('no_pings', bot.filter((m) => /<!(here|channel|everyone)>|<!subteam\^/.test(said(m))).map((m) => `#${m.seq}`));
  fail('one_open_stream', Object.values(Object.groupBy(bot.filter((m) => m.stream === 'open'), (m) => m.thread_ts)).filter((g) => g.length > 1).map((g) => `${g.length} open streams`));
  const twice = (list) => Object.values(Object.groupBy(list, (m) => `${stepOf(m.seq)}|${m.to ?? ''}|${said(m).trim()}`)).filter((g) => g.length > 1).map((g) => `#${g.map((m) => m.seq).join(', #')}: ${said(g[0]).slice(0, 80)}`);
  fail('no_double_post', twice(bot.filter((m) => !m.to)));
  fail('no_double_ephemeral', twice(bot.filter((m) => m.to)));
  fail('bot_errors', botLog.split('\n').filter((l) => /^E .*(TypeError|ReferenceError|SyntaxError|Cannot read|is not a function|event handler threw)/.test(l)).map((l) => l.slice(0, 160)));
  return out;
}
