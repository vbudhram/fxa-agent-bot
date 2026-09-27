// Event → Slack message. Templates only: the bot states facts from events and
// never invents status.
const buttons = (key, ...names) => ({
  type: 'actions',
  elements: names.map(([label, action]) => ({
    type: 'button', text: { type: 'plain_text', text: label }, action_id: action, value: key,
  })),
});

// The agent writes standard Markdown (tables, **bold**, [links](url)); a
// markdown block renders it, where mrkdwn shows the raw syntax. The 12,000 char
// cap is per message; a section block would have failed past 3,000.
const MD_MAX = 11500;
// Agent text is untrusted: it must not ping (@here, @channel, a user group)
// or hide a link behind a label. Slack's special <...> forms become plain text.
const defuse = (t) => String(t ?? '').replace(/<!(here|channel|everyone)[^>]*>/gi, '@$1').replace(/<!subteam\^[^>]*>/gi, '@group')
  .replace(/<@[A-Z0-9]+>/g, '@someone');
const esc = (t) => defuse(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const gh = (u) => (/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(pull\/\d+|compare\/[\w./%?=&-]+)$/.test(String(u ?? '')) ? u : '');
const md = (raw) => {
  const text = defuse(raw);
  return { type: 'markdown', text: text.length > MD_MAX ? `${text.slice(0, MD_MAX)}\n\n_(cut at ${MD_MAX} characters; ask for the rest)_` : text };
};
// Notification and screen-reader fallback: the first line, plain.
const plain = (text) => text.split('\n')[0].replace(/[*_`#>|]/g, '').slice(0, 150) || 'Reply';

// ponytail: the model defaults repeat ctl's runtime-*.sh; set the env on both if one changes.
export const RUNTIMES = {
  claude: { name: 'Claude', provider: 'Anthropic', model: process.env.FXA_AGENT_MODEL || 'claude-opus-5-5' },
  codex: { name: 'Codex', provider: 'OpenAI', model: process.env.FXA_CODEX_MODEL || 'gpt-6-astra' },
};

// Shown for the few seconds before a mention starts a session, so a mistaken
// tag can be taken back or moved to the other agent. A resume keeps its agent.
export function startCard(key, prompt, seconds, resuming = false, runtime = 'claude') {
  const r = RUNTIMES[runtime] ?? RUNTIMES.claude;
  const other = runtime === 'codex' ? 'claude' : 'codex';
  const lead = resuming ? `Picking up where we left off, with your changes and our conversation, in ${seconds} seconds:` : `Starting in ${seconds} seconds:`;
  return [
    { type: 'section', text: { type: 'mrkdwn', text: `${lead}\n>${prompt.split('\n\nEarlier messages')[0].slice(0, 500).replace(/\n/g, '\n>')}` } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `${r.name} · \`${r.model}\` · ${r.provider}` }] },
    resuming ? buttons(key, ['Cancel', 'cancel']) : buttons(key, ['Cancel', 'cancel'], [`Switch to ${RUNTIMES[other].name}`, 'switch_runtime']),
  ];
}
export { md, buttons };

// Problems only the operator can fix, told plainly: a raw gcloud or auth error in
// every thread helps nobody. Each has a kind, so a thread hears it once.
const OPERATOR = [
  [/Reauthentication failed|gcloud auth login|problem refreshing your current auth tokens|invalid_grant/i, 'gcloud',
    "The operator's Google Cloud sign-in expired, so I can't reach the sandbox. The operator must run `gcloud auth login`. Then try again."],
  [/OAuth token has expired|Invalid API key|authentication_error|Please run \/login|CLAUDE_CODE_OAUTH_TOKEN is unset/i, 'claude',
    "The agent's Claude token was rejected. The operator must renew `CLAUDE_CODE_OAUTH_TOKEN`. Then send your message again."],
  [/Codex auth|codex login|refresh_token_reused|token_expired/i, 'codex',
    'The Codex sign-in on the host expired. The operator must sign in to Codex again. Then send your message again.'],
  [/could not mint a GitHub App installation token/i, 'github-app',
    'The GitHub App could not get a token. The operator must check its key and installation. The work is not lost; try again after that.'],
];
export function operatorProblem(text) {
  const hit = OPERATOR.find(([re]) => re.test(String(text ?? '')));
  return hit ? { kind: hit[1], text: hit[2] } : null;
}
const noteLines = (notes) => (notes ?? []).length ? `\n${notes.map((n) => `⚠️ ${esc(n)}`).join('\n')}` : '';
// One line about the whole session: time, turns, cost and the size of the change.
export function summaryLine(sm) {
  if (!sm) return '';
  const parts = [sm.minutes != null && `${sm.minutes} min`, sm.turns && `${sm.turns} turn${sm.turns === 1 ? '' : 's'}`,
    sm.cost != null && `$${Number(sm.cost).toFixed(2)}`, sm.diff && esc(sm.diff)].filter(Boolean);
  return parts.length ? `Session: ${parts.join(' · ')}` : '';
}

export function render(key, ev) {
  switch (ev.type) {
    case 'stage': return { text: `_${esc(ev.text)}_` };
    case 'plan': return { text: `Here's my plan:\n${esc(ev.text)}\nSound right? Reply here to adjust.` };
    case 'question': {
      // Slack cuts a button label short (hard cap 75 chars, far less on a
      // phone), so the options are written out as a numbered list and the
      // buttons carry only the number. The full option rides in the value.
      const opts = (ev.options ?? []).slice(0, 5);
      // The options go in their own mrkdwn block: in the markdown block, a
      // numbered list in the agent's text and this one merged into one list,
      // and its numbers stopped matching the buttons.
      const list = opts.map((o, i) => `*${i + 1}*  ${esc(o).slice(0, 500)}`).join('\n');
      return {
        text: plain(ev.text),
        blocks: [
          md(ev.text || 'Which way?'),
          ...(opts.length ? [{ type: 'section', block_id: 'answer_opts', text: { type: 'mrkdwn', text: `*Pick one:*\n${list}` } }, {
            type: 'actions',
            elements: opts.map((o, i) => ({
              type: 'button', action_id: `answer_${i}`,
              text: { type: 'plain_text', text: String(i + 1) },
              value: JSON.stringify({ key, choice: o.slice(0, 1800) }),
              accessibility_label: o.slice(0, 75),
            })),
          }, { type: 'context', block_id: 'answer_hint', elements: [{ type: 'mrkdwn', text: 'Tap a number, or reply in the thread.' }] }] : []),
        ],
      };
    }
    case 'turn_end':
      if (ev.status === 'needs-input') return { text: plain(ev.text || 'Over to you.'), blocks: [md(ev.text || 'Over to you.')] };
      if (ev.status === 'ready') return {
        text: plain(ev.text || 'All set.'),
        blocks: [
          md(ev.text || 'All set.'),
          buttons(key, ['Diff', 'diff'], ['Push branch', 'push_branch'], ['Open PR', 'open_pr'], ['Stop', 'stop']),
        ],
      };
      return null; // working: stay quiet
    case 'pr': {
      const head = gh(ev.url) ? `Draft PR is up: ${gh(ev.url)}` : 'The draft PR is up; its link did not look like a GitHub PR, so check the repo.';
      const sm = summaryLine(ev.summary);
      return { text: `${head}${noteLines(ev.notes)}${sm ? `\n_${sm}_` : ''}` };
    }
    case 'pushed': return { text: `Pushed \`${esc(ev.branch).replace(/`/g, '')}\`.${gh(ev.url) ? ` <${gh(ev.url)}|Open a PR from it> when you are ready, or keep steering here.` : ' Keep steering here, or open a PR from it on GitHub.'}${noteLines(ev.notes)}` };
    case 'ci': return { text: `CI: ${esc(ev.text)}` };
    case 'error': {
      const op = operatorProblem(ev.text);
      return op ? { text: op.text, operator: op.kind } : { text: `Something went wrong: ${esc(ev.text)} Try again, or \`!restart\` to start fresh.` };
    }
    default: return null;
  }
}

// A step title → the phase it belongs to, so a long run shows one timeline entry
// per kind of work (with a count) instead of one per command. The command itself
// becomes the entry's detail, without its leading `cd <dir> &&`.
export function phase(step) {
  const t = String(step ?? '');
  if (!t.startsWith('Running ')) {
    if (t.startsWith('Reading ')) return { kind: 'read', label: 'Reading files', detail: t.slice(8) };
    if (t.startsWith('Editing ')) return { kind: 'edit', label: 'Editing files', detail: t.slice(8) };
    if (/^(Searching|Finding)/.test(t)) return { kind: 'search', label: 'Searching the code', detail: t };
    if (t.startsWith('Delegating')) return { kind: 'agent', label: 'Working in a subagent', detail: t.slice(12) };
    if (t.startsWith('Updating the plan')) return { kind: 'plan', label: 'Planning', detail: '' };
    if (t.startsWith('Using /')) return { kind: t, label: t, detail: '' }; // each skill is its own phase
    return { kind: 'other', label: t || 'Working', detail: '' };
  }
  const cmd = t.slice(8).replace(/^(cd\s+\S+\s*(&&|;)\s*)+/, '').trim();
  const head = cmd.split('|')[0];
  const rules = [
    [/\b(jest|vitest|mocha|playwright|test-unit)\b|\b(yarn|npm|nx) (run )?test\b/, 'test', 'Running tests'],
    [/\b(eslint|tsc|prettier)\b|\bnx (run-many.*)?(lint|build)\b|\blint\b/, 'check', 'Type-checking and linting'],
    [/^(grep|rg|egrep|find|ls|tree|git grep|ag)\b/, 'search', 'Searching the code'],
    [/^(cat|sed -n|head|tail|wc|less|jq)\b/, 'read', 'Reading files'],
    [/^(sed -i|perl -\S*i|mv|cp|rm|mkdir|tee|patch|touch)\b/, 'edit', 'Editing files'],
    [/^git\b/, 'git', 'Checking git'],
  ];
  for (const [re, kind, label] of rules) if (re.test(head)) return { kind, label, detail: cmd };
  return { kind: 'shell', label: 'Running commands', detail: cmd };
}

// The checklist stage a step belongs to. Coarser than phase(): the agent flips
// between reading and searching constantly, and a row per flip buried the
// progress. null means "no new row": the step joins the current one.
const STAGES = {
  explore: 'Exploring the code', edit: 'Making changes', verify: 'Verifying', review: 'Reviewing',
};
export function stage(step) {
  const t = String(step ?? '');
  const { kind } = phase(t);
  if (['read', 'search', 'git', 'agent', 'plan'].includes(kind)) return { kind: 'explore', label: STAGES.explore };
  if (kind === 'edit') return { kind: 'edit', label: STAGES.edit };
  if (kind === 'test' || kind === 'check' || /^Using \/fxa-(verify|functional-local|stack)/.test(t)) return { kind: 'verify', label: STAGES.verify };
  if (t.startsWith('Using /')) return { kind: 'review', label: STAGES.review };
  return null;
}
