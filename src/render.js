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
        ...(ev.options?.length ? [buttons(key, ...ev.options.map((o, i) => [o, `answer_${i}`]))] : []),
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
    case 'pr': return { text: `PR is up: ${ev.url}` };
    case 'ci': return { text: `CI: ${ev.text}` };
    case 'error': return { text: `Something went wrong: ${ev.text}` };
    default: return null;
  }
}
