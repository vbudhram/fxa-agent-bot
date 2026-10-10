// npm run e2e:view: read each test conversation whole, and write what should change.
// Feedback goes to e2e/feedback/<run>.md and survives reruns; Claude reads it from there.
import { createServer } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out'), FEEDBACK = join(HERE, 'feedback');
const PORT = Number(process.env.PORT || 8787);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const read = (run, f) => { try { return JSON.parse(readFileSync(join(OUT, run, f), 'utf8')); } catch { return null; } };
const runs = () => readdirSync(OUT, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.') && existsSync(join(OUT, d.name, 'thread.html'))).map((d) => d.name).sort();
const fbFile = (run) => join(FEEDBACK, `${run}.md`);
const feedback = (run) => (existsSync(fbFile(run)) ? readFileSync(fbFile(run), 'utf8') : '');

// The scenario's own words: its title and what good looks like.
function about(run) {
  const m = read(run, 'meta.json'), src = m?.scenario && existsSync(m.scenario) ? readFileSync(m.scenario, 'utf8') : '';
  const pick = (k) => src.match(new RegExp(`${k}: '((?:[^'\\\\]|\\\\.)*)'`))?.[1]?.replace(/\\'/g, "'") ?? src.match(new RegExp(`"${k}": "([^"]*)"`))?.[1] ?? '';
  return { title: pick('title') || (m?.persona ? `Claude personas: ${m.persona}` : run), good: pick('judge') };
}

const CSS = `body{font:15px/1.5 -apple-system,sans-serif;margin:0;background:#fff;color:#1d1c1d}
header{background:#3f0e40;color:#fff;padding:10px 20px;display:flex;gap:16px;align-items:center}header a{color:#fff}
.wrap{max-width:900px;margin:0 auto;padding:16px 20px}.about{color:#555;margin:4px 0 16px}
ol{padding-left:20px}li{margin:6px 0}.done{color:#007a5a}.mute{color:#888;font-size:13px}
.msg{cursor:pointer;border-radius:6px}.msg:hover{background:#fff8e1;outline:1px dashed #ecb22e}
#fb{position:sticky;bottom:0;background:#fff;border-top:2px solid #3f0e40;padding:10px 0}
textarea{width:100%;height:120px;font:inherit;box-sizing:border-box}button{font:inherit;padding:6px 16px;background:#007a5a;color:#fff;border:0;border-radius:4px}
pre{white-space:pre-wrap;background:#f6f6f6;padding:8px;font-size:13px}details{margin:12px 0}`;
const page = (t, body, nav = '') => `<!doctype html><meta charset="utf-8"><title>${esc(t)}</title><style>${CSS}</style><header><a href="/">All conversations</a>${nav}</header>${body}`;

function index() {
  const items = runs().map((r) => {
    const a = about(r), res = read(r, 'result.json'), fb = feedback(r);
    return `<li><a href="/run/${encodeURIComponent(r)}">${esc(a.title)}</a> <span class="mute">${esc(r)}${res && !res.ok ? ' · checks failed' : ''}</span>${fb ? ' <span class="done">✓ feedback</span>' : ''}</li>`;
  }).join('');
  return page('Test conversations', `<div class="wrap"><h1 style="font-size:20px">Test conversations</h1>
    <p class="about">Open one, read it top to bottom, and write what you would change. Click a message to point at it.</p><ol>${items}</ol></div>`);
}

function runPage(r) {
  const all = runs(), i = all.indexOf(r), a = about(r), res = read(r, 'result.json'), j = read(r, 'judge.json');
  const thread = readFileSync(join(OUT, r, 'thread.html'), 'utf8').replace(/^[\s\S]*?<style>/, '<style>').replace(/body\{[^}]*\}/, '').replace('<body>', '').replace('</body>', '');
  const nav = `${i > 0 ? ` · <a href="/run/${encodeURIComponent(all[i - 1])}">← previous</a>` : ''}${i < all.length - 1 ? ` · <a href="/run/${encodeURIComponent(all[i + 1])}">next →</a>` : ''}`;
  const extra = `<details><summary>What the automatic checks said</summary><pre>${esc([...(res?.failures ?? []).map((f) => `failed: ${f}`), ...(res?.xfail ?? []).map((f) => `known bug: ${f}`)].join('\n') || 'all passed')}</pre>
    ${j ? `<pre>${esc(`Judge (${j.model}) ${j.total}/${j.max}\n${j.findings.map((f) => `${f.severity} ${f.msg_ref}: ${f.evidence}`).join('\n')}`)}</pre>` : ''}</details>`;
  return page(a.title, `<div class="wrap"><h1 style="font-size:20px">${esc(a.title)}</h1><div class="about">${a.good ? `Good looks like: ${esc(a.good)}` : ''}<br><span class="mute">Brown lines like [A taps "Open PR"] are what the test did. A shaded message is visible only to the person named.</span></div>
    ${thread}${extra}
    ${feedback(r) ? `<details open><summary>Your earlier feedback</summary><pre>${esc(feedback(r))}</pre></details>` : ''}
    <form id="fb" method="post" action="/feedback/${encodeURIComponent(r)}"><textarea name="text" placeholder="What is wrong in this conversation, and what should the bot do or say instead? Click a message to add its number."></textarea>
    <button>Save feedback</button> <span class="mute">Saved to e2e/feedback/${esc(r)}.md</span></form></div>
    <script>document.querySelectorAll('.msg').forEach((m) => m.addEventListener('click', () => { const t = document.querySelector('textarea'); t.value += (t.value && !t.value.endsWith('\\n') ? '\\n' : '') + '#' + m.dataset.seq + ': '; t.focus(); }));</script>`, nav);
}

const body = (req) => new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => resolve(new URLSearchParams(b))); });
const send = (res, code, html) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); };

createServer(async (req, res) => {
  const [, kind, run] = decodeURIComponent(req.url.split('?')[0]).split('/');
  try {
    if (!kind) return send(res, 200, index());
    if (!runs().includes(run)) return send(res, 404, 'no such conversation');
    if (kind === 'run') return send(res, 200, runPage(run));
    if (kind === 'feedback' && req.method === 'POST') {
      const text = ((await body(req)).get('text') ?? '').trim();
      if (text) { mkdirSync(FEEDBACK, { recursive: true }); appendFileSync(fbFile(run), `## ${new Date().toISOString()} · ${about(run).title}\n\n${text}\n\n`); }
      res.writeHead(303, { location: `/run/${encodeURIComponent(run)}` }); return res.end();
    }
    send(res, 404, 'not found');
  } catch (e) { send(res, 500, `<pre>${esc(e.stack)}</pre>`); }
}).listen(PORT, '127.0.0.1', () => console.log(`Test conversations: http://127.0.0.1:${PORT}/`));
