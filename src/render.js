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
const md = (text) => ({
  type: 'markdown',
  text: text.length > MD_MAX ? `${text.slice(0, MD_MAX)}\n\n_(cut at ${MD_MAX} characters; ask for the rest)_` : text,
});
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

export function render(key, ev) {
  switch (ev.type) {
    case 'stage': return { text: `_${ev.text}_` };
    case 'plan': return { text: `Here's my plan:\n${ev.text}\nSound right? Reply here to adjust.` };
    case 'question': {
      // Slack cuts a button label short (hard cap 75 chars, far less on a
      // phone), so the options are written out as a numbered list and the
      // buttons carry only the number. The full option rides in the value.
      const opts = (ev.options ?? []).slice(0, 5);
      const list = opts.map((o, i) => `${i + 1}. ${o}`).join('\n');
      return {
        text: plain(ev.text),
        blocks: [
          md(opts.length ? `${ev.text || 'Which way?'}\n\n${list}` : (ev.text || 'Which way?')),
          ...(opts.length ? [{
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
    case 'pr': return { text: `Draft PR is up: ${ev.url}` };
    case 'pushed': return { text: `Pushed \`${ev.branch}\`. <${ev.url}|Open a PR from it> when you are ready, or keep steering here.` };
    case 'ci': return { text: `CI: ${ev.text}` };
    case 'error': return { text: `Something went wrong: ${ev.text} Try again, or \`!restart\` to start fresh.` };
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
