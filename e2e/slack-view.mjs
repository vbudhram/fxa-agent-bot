// The fake Slack workspace: every Web API call the bot makes lands here, and the thread
// as each person sees it comes out. No network.

export const BOT = { user_id: 'UBOT', bot_id: 'BBOT', team_id: 'T1' };

export function createView({ names = {} } = {}) {
  const msgs = []; // {ts, channel, thread_ts, user|bot, text, blocks, to, chunks, edits, reactions:Set, deleted, seq}
  const calls = []; // {at, method, args}
  let clock = Math.floor(Date.now() / 1000) * 1e6, seq = 0, chg = 0, lastCall = Date.now();
  const touch = (m) => { m.chg = ++chg; return m; };
  const nextTs = () => { clock += 100; return `${Math.floor(clock / 1e6)}.${String(clock % 1e6).padStart(6, '0')}`; };
  const find = (channel, ts) => msgs.find((m) => m.channel === channel && m.ts === ts);
  const err = (code) => Object.assign(new Error(`An API error occurred: ${code}`), { code: 'slack_webapi_platform_error', data: { ok: false, error: code } });

  // A message from a person, posted by the harness. Returns its ts.
  function personSays(user, channel, text, thread_ts) {
    const m = touch({ ts: nextTs(), channel, thread_ts, user, text, edits: 0, reactions: new Set(), seq: ++seq });
    msgs.push(m);
    return m;
  }
  const personEdit = (m, text) => { m.text = text; m.edits++; touch(m); };
  const personDelete = (m) => { m.deleted = true; touch(m); };
  const personReact = (m, user, name) => { (m.marks ??= []).push(`${name} by ${user}`); touch(m); };

  // A stream's chunks: a task_update with an id we already have replaces that row.
  function addChunks(m, chunks = []) {
    for (const c of chunks) {
      const i = c.type === 'task_update' ? m.chunks.findIndex((x) => x.type === 'task_update' && x.id === c.id) : -1;
      if (i >= 0) m.chunks[i] = c; else m.chunks.push(c);
    }
  }

  function apply(method, args = {}) {
    lastCall = Date.now();
    calls.push({ at: lastCall, method, args });
    const { channel } = args;
    switch (method) {
      case 'auth.test': return { ok: true, ...BOT, user: 'fxa-agent', url: 'https://fake.slack.com/' };
      case 'chat.postMessage': {
        const m = { ts: nextTs(), channel, thread_ts: args.thread_ts, bot: true, text: args.text ?? '', blocks: args.blocks, edits: 0, reactions: new Set(), seq: ++seq };
        msgs.push(touch(m));
        return { ok: true, channel, ts: m.ts, message: { ...m, reactions: undefined } };
      }
      case 'chat.postEphemeral': {
        const m = { ts: nextTs(), channel, thread_ts: args.thread_ts, bot: true, to: args.user, text: args.text ?? '', blocks: args.blocks, edits: 0, reactions: new Set(), seq: ++seq };
        msgs.push(touch(m));
        return { ok: true, message_ts: m.ts };
      }
      case 'chat.update': {
        const m = find(channel, args.ts);
        if (!m || m.deleted) throw err('message_not_found');
        if ('text' in args) m.text = args.text;
        // New blocks replace a finished stream's task card too, as in Slack.
        if ('blocks' in args) { m.blocks = args.blocks; if (m.stream === 'closed') m.chunks = []; }
        m.edits++; touch(m);
        return { ok: true, channel, ts: m.ts };
      }
      case 'chat.delete': {
        const m = find(channel, args.ts);
        if (!m) throw err('message_not_found');
        m.deleted = true; touch(m);
        return { ok: true };
      }
      case 'chat.getPermalink': return { ok: true, permalink: `https://fake.slack.com/archives/${channel}/p${String(args.message_ts).replace('.', '')}` };
      case 'chat.startStream': {
        const m = { ts: nextTs(), channel, thread_ts: args.thread_ts, bot: true, text: '', chunks: [], stream: 'open', edits: 0, reactions: new Set(), seq: ++seq };
        addChunks(m, args.chunks);
        msgs.push(touch(m));
        return { ok: true, channel, ts: m.ts };
      }
      case 'chat.appendStream': case 'chat.stopStream': {
        const m = find(channel, args.ts);
        if (!m || m.stream !== 'open') throw err('message_not_in_streaming_state');
        addChunks(m, args.chunks);
        if (method === 'chat.stopStream') { m.stream = 'closed'; if (args.blocks) m.blocks = args.blocks; }
        touch(m);
        return { ok: true, channel, ts: m.ts };
      }
      case 'reactions.add': case 'reactions.remove': {
        const m = find(channel, args.timestamp);
        if (!m) throw err('message_not_found');
        const has = m.reactions.has(args.name);
        if (method === 'reactions.add') { if (has) throw err('already_reacted'); m.reactions.add(args.name); }
        else { if (!has) throw err('no_reaction'); m.reactions.delete(args.name); }
        touch(m);
        return { ok: true };
      }
      case 'conversations.replies': {
        const all = msgs.filter((m) => m.channel === channel && !m.to && !m.deleted && (m.ts === args.ts || m.thread_ts === args.ts));
        const from = Number(args.cursor ?? 0), n = Number(args.limit ?? 1000);
        const page = all.slice(from, from + n).map((m) => ({ ts: m.ts, thread_ts: m.thread_ts ?? m.ts, text: m.text, blocks: m.blocks,
          ...(m.bot ? { bot_id: BOT.bot_id, user: BOT.user_id } : { user: m.user }) }));
        const more = from + n < all.length;
        return { ok: true, messages: page, has_more: more, response_metadata: { next_cursor: more ? String(from + n) : '' } };
      }
      case 'users.info': {
        const name = names[args.user] ?? args.user;
        return { ok: true, user: { id: args.user, name, real_name: name, profile: { display_name: name, real_name: name, image_48: '' } } };
      }
      default: return { ok: true };
    }
  }

  return { msgs, calls, apply, personSays, personEdit, personDelete, personReact, quietFor: () => Date.now() - lastCall, chg: () => chg };
}

const richText = (x) => (!x || typeof x !== 'object' ? '' : Array.isArray(x) ? x.map(richText).join('')
  : (typeof x.text === 'string' ? x.text : x.type === 'user' ? `<@${x.user_id}>` : '') + richText(x.elements));

// Block Kit to plain lines: text of each block, and the button labels.
export function blockText(blocks = []) {
  const lines = [], buttons = [];
  const txt = (t) => (typeof t === 'string' ? t : t?.text ?? '');
  for (const b of blocks) {
    if (b.type === 'section') { if (b.text) lines.push(txt(b.text)); for (const f of b.fields ?? []) lines.push(txt(f));
      if (b.accessory?.type === 'button') buttons.push(txt(b.accessory.text)); else if (b.accessory) buttons.push(`<${b.accessory.type}: ${(b.accessory.options ?? []).map((o) => txt(o.text)).join(' | ')}>`); }
    // A markdown block renders [text](url) as a link; mrkdwn does not, so only here.
    else if (b.type === 'markdown') lines.push(b.text.replace(/\[([^\]\n]+)\]\((https?:[^)\s]+)\)/g, '<$2|$1>'));
    else if (b.type === 'context') lines.push(b.elements.map(txt).filter(Boolean).join(' '));
    else if (b.type === 'header') lines.push(`# ${txt(b.text)}`);
    else if (b.type === 'actions') for (const e of b.elements ?? []) buttons.push(e.type === 'button' ? txt(e.text) : `<${e.type}>`);
    else if (b.type === 'rich_text') lines.push(richText(b.elements));
    else if (b.type !== 'divider') lines.push(`<${b.type}>`);
  }
  return { lines: lines.filter(Boolean), buttons };
}

// The thread as text: one entry per message, in post order, with who sees an ephemeral.
export function toText(view, { channel, thread_ts, who = (u) => u, notes = [], viewer }) {
  const rows = [];
  for (const m of view.msgs) {
    if (m.channel !== channel || (m.ts !== thread_ts && m.thread_ts !== thread_ts)) continue;
    if (viewer && m.to && m.to !== viewer) continue;
    const head = [`#${m.seq}`, m.bot ? 'bot' : who(m.user)];
    if (m.to) head.push(`(ephemeral -> ${who(m.to)})`);
    if (m.edits) head.push(`(edited x${m.edits})`);
    if (m.deleted) head.push('(deleted)');
    if (m.stream) head.push(`(stream ${m.stream})`);
    const { lines, buttons } = blockText(m.blocks);
    const body = lines.length ? lines : [m.text];
    for (const c of m.chunks ?? []) body.push(c.type === 'task_update' ? `  ${c.status === 'complete' ? '✓' : c.status === 'in_progress' ? '›' : '○'} ${c.title}${c.details ? ` (${c.details})` : ''}` : `  ${c.text ?? JSON.stringify(c)}`);
    rows.push({ seq: m.seq, text: [`${head.join(' ')}: ${body.join('\n    ')}`,
      ...(buttons.length ? [`    buttons: ${buttons.map((b) => `[${b}]`).join(' ')}`] : []),
      ...(m.reactions.size ? [`    reactions: ${[...m.reactions].map((r) => `:${r}:`).join(' ')}`] : []),
      ...(m.marks?.length ? [`    marked: ${m.marks.map((r) => `:${r.replace(' by U', ': by ')}`).join(', ')}`] : [])].join('\n') });
  }
  for (const n of notes) rows.push(n);
  return rows.sort((a, b) => a.seq - b.seq || (a.note ? -1 : 1)).map((r) => r.text).join('\n');
}
