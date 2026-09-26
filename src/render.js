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

// Shown for the few seconds before a mention starts a session, so a mistaken
// tag can be taken back.
export function startCard(key, prompt, seconds, resuming = false) {
  const lead = resuming ? `Picking up where we left off, with your changes and our conversation, in ${seconds} seconds:` : `Starting in ${seconds} seconds:`;
  return [
    { type: 'section', text: { type: 'mrkdwn', text: `${lead}\n>${prompt.split('\n\nEarlier messages')[0].slice(0, 500).replace(/\n/g, '\n>')}` } },
    buttons(key, ['Cancel', 'cancel']),
  ];
}
export { md, buttons };

export function render(key, ev) {
  switch (ev.type) {
    case 'stage': return { text: `_${ev.text}_` };
    case 'plan': return { text: `Here's my plan:\n${ev.text}\nSound right? Reply here to adjust.` };
    case 'question': return {
      text: plain(ev.text),
      blocks: [
        md(ev.text || 'Which way?'),
        // Slack caps a label at 75 chars and rejects the message over it; the
        // full option rides in the value and is what gets sent.
        ...(ev.options?.length ? [{
          type: 'actions',
          elements: ev.options.slice(0, 5).map((o, i) => ({
            type: 'button', action_id: `answer_${i}`,
            text: { type: 'plain_text', text: o.length > 75 ? `${o.slice(0, 72)}...` : o },
            value: JSON.stringify({ key, choice: o.slice(0, 1800) }),
          })),
        }] : []),
      ],
    };
    case 'turn_end':
      if (ev.status === 'needs-input') return { text: plain(ev.text || 'Over to you.'), blocks: [md(ev.text || 'Over to you.')] };
      if (ev.status === 'ready') return {
        text: plain(ev.text || 'All set.'),
        blocks: [
          md(ev.text || 'All set.'),
          buttons(key, ['Diff', 'diff'], ['Open PR', 'open_pr'], ['Stop', 'stop']),
        ],
      };
      return null; // working: stay quiet
    case 'pr': return { text: `Draft PR is up: ${ev.url}` };
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
