export default {
  title: 'A tagged reply in a moved thread does not start a session (bot commit bbbbfe5)',
  matrix: { order: ['message_first', 'mention_first'] },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: { tap: 'Open PR' } }, { advance: 'finish', wait: { text: /pull\/999999/ } },
    { A: '!stop' },
    { A: '@bot !stack checkout https://github.com/mozilla/fxa/pull/999999', thread: 'T2', wait: { text: /Moving/ } },
    { A: '@bot one more change',
      expect: { noCtl: { cmd: 'task', thread: 'T1' }, postCount: { thread: 'T1', match: /moved to/i, n: 2 } } },
  ],
  judge: 'T1 points to T2. Nothing new starts in T1. T2 has the PR card and the session.',
};
