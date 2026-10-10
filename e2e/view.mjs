// npm run e2e:view: a local dashboard of the runs in e2e/out. Each thread as Slack lays it out,
// the hard checks, the judge's findings, and a form for a person's own scores (human.json).
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { judge, MODEL } from './judge.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
const PORT = Number(process.env.PORT || 8787);
const RUBRIC = ['clarity', 'addressee', 'steer_followed', 'tone', 'ste', 'no_internal_leak', 'buttons_sensible', 'no_noise', 'visual'];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const read = (run, f) => { try { return JSON.parse(readFileSync(join(OUT, run, f), 'utf8')); } catch { return null; } };
const runs = () => readdirSync(OUT, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.') && existsSync(join(OUT, d.name, 'result.json'))).map((d) => d.name).sort();
const okName = (n) => runs().includes(n);
const sum = (s) => (s ? Object.values(s).reduce((a, b) => a + b, 0) : null);

function title(run) {
  const m = read(run, 'meta.json');
  const src = m?.scenario && existsSync(m.scenario) ? readFileSync(m.scenario, 'utf8') : '';
  return src.match(/title: '([^']*)'/)?.[1] ?? src.match(/"title": "([^"]*)"/)?.[1] ?? (m?.persona ? `persona ${m.persona}` : '');
}

const CSS = `body{font:14px/1.45 -apple-system,sans-serif;margin:0;color:#1d1c1d;background:#f8f8f8}
header{background:#3f0e40;color:#fff;padding:10px 16px}header a{color:#fff}main{padding:12px 16px}
table{border-collapse:collapse;width:100%;background:#fff}td,th{border-bottom:1px solid #eee;padding:6px 8px;text-align:left;vertical-align:top}
.ok{color:#007a5a;font-weight:600}.bad{color:#e01e5a;font-weight:600}.known{color:#9a6700}.mute{color:#888}
.grid{display:grid;grid-template-columns:900px 1fr;gap:16px}iframe{width:900px;height:85vh;border:1px solid #ddd;background:#fff}
.card{background:#fff;border:1px solid #ddd;border-radius:6px;padding:10px 12px;margin-bottom:12px}h3{margin:0 0 6px}
.f{border-left:3px solid #ddd;padding-left:8px;margin:6px 0}.blocker,.major{border-color:#e01e5a}.minor{border-color:#ecb22e}
label{display:inline-block;width:140px}select,textarea{font:inherit}textarea{width:100%;height:90px}button{font:inherit;padding:4px 12px}
pre{white-space:pre-wrap;font-size:12px;background:#fff;border:1px solid #ddd;padding:8px;max-height:50vh;overflow:auto}
@media (max-width:1300px){.grid{grid-template-columns:1fr}iframe{width:100%}}`;
const page = (t, body) => `<!doctype html><meta charset="utf-8"><title>${esc(t)}</title><style>${CSS}</style><header><a href="/">e2e runs</a> · ${esc(t)}</header><main>${body}</main>`;

function index() {
  const rows = runs().map((r) => {
    const res = read(r, 'result.json'), j = read(r, 'judge.json'), h = read(r, 'human.json');
    return `<tr><td><a href="/run/${encodeURIComponent(r)}">${esc(r)}</a><div class="mute">${esc(title(r))}</div></td>
      <td class="${res.ok ? 'ok' : 'bad'}">${res.ok ? 'pass' : 'FAIL'}${res.failures.length ? `<div class="bad">${res.failures.map(esc).join('<br>')}</div>` : ''}${res.xfail.length ? `<div class="known">${res.xfail.length} known</div>` : ''}</td>
      <td>${j ? `${j.total}/${j.max}` : '<span class="mute">not judged</span>'}</td>
      <td>${h ? `${h.verdict} ${sum(h.scores)}/${RUBRIC.length * 2}${h.notes ? `<div class="mute">${esc(h.notes.slice(0, 80))}</div>` : ''}` : '<span class="mute">not yet</span>'}</td></tr>`;
  }).join('');
  return page('e2e runs', `<p>Run <code>npm run e2e -- --png</code> to refresh. Judge model: ${esc(MODEL)} (about $2 a thread; on request only).</p>
    <table><tr><th>Run</th><th>Hard checks</th><th>Judge</th><th>Your score</th></tr>${rows}</table>`);
}

function runPage(r) {
  const res = read(r, 'result.json'), j = read(r, 'judge.json'), h = read(r, 'human.json') ?? {};
  const txt = existsSync(join(OUT, r, 'thread.txt')) ? readFileSync(join(OUT, r, 'thread.txt'), 'utf8') : '';
  const checks = `<div class="card"><h3>Hard checks: <span class="${res.ok ? 'ok' : 'bad'}">${res.ok ? 'pass' : 'FAIL'}</span></h3>
    ${res.failures.map((f) => `<div class="bad">✗ ${esc(f)}</div>`).join('')}${res.xfail.map((f) => `<div class="known">~ known: ${esc(f)}</div>`).join('')}${res.fixed.map((f) => `<div>! ${esc(f)}</div>`).join('')}</div>`;
  const judged = j ? `<div class="card"><h3>Judge (${esc(j.model)}): ${j.total}/${j.max}, ${esc(j.verdict)}</h3>
    <div>${Object.entries(j.scores).map(([k, v]) => `<span class="${v < 2 ? 'known' : 'mute'}">${k}=${v}</span>`).join(' · ')}</div>
    ${j.findings.map((f) => `<div class="f ${f.severity}"><b>${esc(f.severity)}</b> ${esc(f.msg_ref)} ${esc(f.rubric_id)}: ${esc(f.evidence)}<div class="mute">fix: ${esc(f.fix)}</div></div>`).join('')}
    <p>${esc(j.summary)}</p></div>`
    : `<div class="card"><h3>Judge</h3><form method="post" action="/judge/${encodeURIComponent(r)}"><button>Ask ${esc(MODEL)} (about $2)</button></form></div>`;
  const opt = (k, v) => `<option${h.scores?.[k] === v ? ' selected' : ''}>${v}</option>`;
  const form = `<div class="card"><h3>Your judgment</h3><form method="post" action="/human/${encodeURIComponent(r)}">
    <div><label>Verdict</label><select name="verdict">${['good', 'ok', 'bad'].map((v) => `<option${h.verdict === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
    ${RUBRIC.map((k) => `<div><label>${k}</label><select name="${k}">${opt(k, 2)}${opt(k, 1)}${opt(k, 0)}</select></div>`).join('')}
    <div>Notes: what is wrong, which message, what it should say</div><textarea name="notes">${esc(h.notes)}</textarea>
    <button>Save</button> ${h.at ? `<span class="mute">saved ${esc(h.at)}</span>` : ''}</form></div>`;
  return page(r, `<div class="mute">${esc(title(r))}</div><div class="grid"><iframe src="/file/${encodeURIComponent(r)}/thread.html"></iframe>
    <div>${checks}${form}${judged}<details><summary>Thread as text</summary><pre>${esc(txt)}</pre></details>
    <details><summary>Controller calls</summary><pre>${esc(existsSync(join(OUT, r, 'ctl.jsonl')) ? readFileSync(join(OUT, r, 'ctl.jsonl'), 'utf8').split('\n').filter((l) => l && !l.includes('"events"') && !l.includes('"watch"')).join('\n') : '')}</pre></details></div></div>`);
}

const body = (req) => new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => resolve(new URLSearchParams(b))); });
const send = (res, code, html, type = 'text/html; charset=utf-8') => { res.writeHead(code, { 'content-type': type }); res.end(html); };

createServer(async (req, res) => {
  const [, kind, raw, file] = decodeURIComponent(req.url.split('?')[0]).split('/');
  try {
    if (!kind) return send(res, 200, index());
    if (!okName(raw)) return send(res, 404, 'no such run');
    if (kind === 'run') return send(res, 200, runPage(raw));
    if (kind === 'file' && ['thread.html', 'thread.png'].includes(file)) return send(res, 200, readFileSync(join(OUT, raw, file)), file.endsWith('png') ? 'image/png' : 'text/html; charset=utf-8');
    if (req.method === 'POST' && kind === 'human') {
      const f = await body(req);
      writeFileSync(join(OUT, raw, 'human.json'), JSON.stringify({ verdict: f.get('verdict'), scores: Object.fromEntries(RUBRIC.map((k) => [k, Number(f.get(k))])), notes: f.get('notes') ?? '', at: new Date().toISOString() }, null, 2));
    } else if (req.method === 'POST' && kind === 'judge') await judge(join(OUT, raw));
    else return send(res, 404, 'not found');
    res.writeHead(303, { location: `/run/${encodeURIComponent(raw)}` }); res.end();
  } catch (e) { send(res, 500, `<pre>${esc(e.stack)}</pre>`); }
}).listen(PORT, '127.0.0.1', () => console.log(`e2e dashboard: http://127.0.0.1:${PORT}/`));
