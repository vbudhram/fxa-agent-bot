export default {
  title: 'Investigation from a Slack session: its thread gets the same posted line as the routine\'s own thread',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/investigate-from.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200' },
  steps: [
    { A: '@bot investigate FXA-123', wait: 'none' },
    { starts: 2, root: /^Investigation of <https:\/\/example\.atlassian\.net\/browse\/FXA-123\|FXA-123> started\.$/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /^Investigation posted on / } },
    { expect: { postCount: { thread: 'T1', match: /^Investigation posted on <https:\/\/example\.atlassian\.net\/browse\/FXA-123\|FXA-123>$/, n: 1 } } },
  ],
  judge: 'The thread that asked for the investigation gets one line with the link when the comment posts.',
};
