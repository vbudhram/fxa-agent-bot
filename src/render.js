// Event → Slack message. Templates only: the bot states facts from events and
// never invents status.
const buttons = (key, ...names) => ({
  type: 'actions',
  elements: names.map(([label, action]) => ({
    type: 'button', text: { type: 'plain_text', text: label }, action_id: action, value: key,
  })),
});

export function setupCard(key, prompt) {
  return [
    { type: 'section', text: { type: 'mrkdwn', text: `I can take this on:\n>${prompt.slice(0, 500).replace(/\n/g, '\n>')}` } },
    buttons(key, ['Start', 'start'], ['Cancel', 'cancel']),
  ];
}

export function render(key, ev) {
  switch (ev.type) {
    case 'stage': return { text: `_${ev.text}_` };
    case 'plan': return { text: `Here's my plan:\n${ev.text}\nSound right? Reply here to adjust.` };
    case 'question': return {
      text: ev.text,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: ev.text } },
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
      if (ev.status === 'needs-input') return { text: ev.text || 'Over to you.' };
      if (ev.status === 'ready') return {
        text: 'All set.',
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: ev.text || 'All set.' } },
          buttons(key, ['Diff', 'diff'], ['Open PR', 'open_pr'], ['Stop', 'stop']),
        ],
      };
      return null; // working: stay quiet
    case 'pr': return { text: `Draft PR is up: ${ev.url}` };
    case 'ci': return { text: `CI: ${ev.text}` };
    case 'error': return { text: `Something went wrong: ${ev.text}` };
    default: return null;
  }
}
