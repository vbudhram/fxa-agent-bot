// !pr while a question waits takes its answer buttons away. Their hint must go with them.
export default {
  title: 'A question, then !pr: the answer buttons go, and so does "Tap a number"',
  tape: 'tapes/question.json',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /^1$/ } },
    { A: '!pr', expect: { ctl: { cmd: 'finish', n: 1 }, noButtonsLeft: true, noText: /Tap a number/ } },
  ],
  judge: 'After !pr no hint is left that points at buttons that are gone.',
};
