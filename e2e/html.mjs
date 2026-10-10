// A thread as Slack lays it out, for the PNG the judge reads. An approximation: real Slack
// rendering (fonts, the stream UI, Show more) differs.
import { blockText } from './slack-view.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const EMOJI = { eyes: '👀', white_check_mark: '✅', warning: '⚠️', hourglass_flowing_sand: '⏳', '-1': '👎', raised_hands: '🙌', x: '❌' };

// Slack mrkdwn to HTML: links, mentions, bold, italic, code, quotes.
function mrkdwn(t, who) {
  return esc(t)
    .replace(/&lt;@(U\w+)&gt;/g, (_, u) => `<span class="at">@${esc(who(u))}</span>`)
    .replace(/&lt;(https?:[^|&]+)\|([^&]+)&gt;/g, '<a>$2</a>').replace(/&lt;(https?:[^&]+)&gt;/g, '<a>$1</a>')
    .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>').replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1<b>$2</b>').replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>')
    .replace(/^&gt; ?(.*)$/gm, '<q>$1</q>').replace(/:([a-z_0-9+-]+):/g, (all, n) => EMOJI[n] ?? all).replace(/\n/g, '<br>');
}

function message(m, who) {
  const { lines, buttons } = blockText(m.blocks);
  const body = (lines.length ? lines : [m.text]).map((l) => `<div>${mrkdwn(l, who)}</div>`).join('');
  const rows = (m.chunks ?? []).map((c) => (c.type === 'task_update'
    ? `<div class="row ${c.status}">${c.status === 'complete' ? '✓' : c.status === 'in_progress' ? '◌' : '○'} ${esc(c.title)}${c.details ? `<span class="det"> ${esc(c.details)}</span>` : ''}</div>`
    : `<div>${mrkdwn(c.text ?? '', who)}</div>`)).join('');
  const name = m.bot ? 'fxa-agent <span class="app">APP</span>' : esc(who(m.user));
  return `<div class="msg${m.to ? ' eph' : ''}${m.deleted ? ' del' : ''}" data-seq="${m.seq}">
  <div class="av ${m.bot ? 'bot' : ''}">${m.bot ? '🦊' : esc(who(m.user)[0])}</div>
  <div class="main">
    ${m.to ? `<div class="only">👁 Only visible to you (${esc(who(m.to))})</div>` : ''}
    <div class="who">${name} <span class="seq">#${m.seq}</span>${m.edits && !m.bot ? ' <span class="ed">(edited)</span>' : ''}</div>
    ${m.deleted ? '<div class="gone">This message was deleted.</div>' : `${rows ? `<div class="stream">${rows}</div>` : ''}${body}`}
    ${buttons.length ? `<div class="btns">${buttons.map((b) => `<span class="btn">${esc(b)}</span>`).join('')}</div>`
      : m.retired ? `<div class="btns gone-btns">${m.retired.map((b) => `<span class="btn">${esc(b)}</span>`).join('')} <span class="mute">later removed</span></div>` : ''}
    ${m.reactions.size || m.marks?.length ? `<div class="reacts">${[...m.reactions].map((r) => `<span>${EMOJI[r] ?? `:${r}:`}</span>`).join('')}${(m.marks ?? []).map((r) => `<span>${EMOJI[r.split(' ')[0]] ?? r.split(' ')[0]} ${esc(who(r.split(' by ')[1]))}</span>`).join('')}</div>` : ''}
  </div></div>`;
}

export function toHtml(view, { channel, roots, who, notes = [] }) {
  const threads = Object.entries(roots).map(([t, ts]) => {
    const items = view.msgs.filter((m) => m.channel === channel && (m.ts === ts || m.thread_ts === ts)).map((m) => ({ seq: m.seq, html: message(m, who) }))
      .concat(notes.filter((n) => n.t === t).map((n) => ({ seq: n.seq, html: `<div class="note">${esc(n.text)}</div>` }))).sort((a, b) => a.seq - b.seq);
    return `<section><h2>Thread ${esc(t)}</h2>${items.map((i) => i.html).join('')}</section>`;
  }).join('');
  return `<!doctype html><meta charset="utf-8"><style>
body{font:15px/1.45 -apple-system,"Segoe UI",sans-serif;color:#1d1c1d;background:#fff;margin:0;padding:12px 16px;width:860px}
h2{font-size:13px;color:#616061;border-bottom:1px solid #ddd;padding-bottom:4px}
.msg{display:flex;gap:8px;padding:6px 4px}.eph{background:#f4f7fb;border-left:3px solid #1264a3}.del{opacity:.5}
.av{width:36px;height:36px;border-radius:6px;background:#4a154b;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none}.av.bot{background:#ff9400;font-size:20px}
.main{flex:1;min-width:0}.who{font-weight:700}.seq,.ed{font-weight:400;color:#888;font-size:12px}.app{background:#ddd;font-size:10px;padding:0 3px;border-radius:2px;color:#555}
.only{font-size:12px;color:#616061}.gone{color:#888;font-style:italic}
.stream{border:1px solid #e8e8e8;border-radius:6px;padding:4px 8px;margin:2px 0;font-size:14px}.row.in_progress{color:#1264a3}.det{color:#888}
.btns{margin-top:4px;display:flex;gap:6px;flex-wrap:wrap}.gone-btns .btn{opacity:.4;text-decoration:line-through}.mute{color:#888;font-size:12px}.btn{border:1px solid #bbb;border-radius:4px;padding:2px 10px;font-weight:600;font-size:13px}
.reacts{margin-top:3px;display:flex;gap:4px}.reacts span{background:#eef3f8;border:1px solid #d0e0ef;border-radius:12px;padding:0 6px;font-size:13px}
.at{background:#e8f5fa;color:#1264a3}a{color:#1264a3}code{background:#f6f6f6;border:1px solid #ddd;padding:0 3px;font-size:13px}pre{background:#f6f6f6;padding:6px;white-space:pre-wrap}q{display:block;border-left:3px solid #ddd;padding-left:8px}q:before,q:after{content:none}
.note{color:#9a6700;font:12px monospace;margin:2px 0 2px 48px}
</style><body>${threads}</body>`;
}
