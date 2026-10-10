export default {
  title: 'The agent asks a question with options; A answers by a reply, by a tap, or stops',
  tape: 'tapes/question.json',
  matrix: { answer: ['reply', 'stop', 'tap'] },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /^1$/ } },
    { A: 'on submit please', only: { answer: ['reply'] }, expect: { ctl: { cmd: 'steer', match: /on submit/ }, noButtonsLeft: true } },
    { advance: 'turn', wait: 'turn_end', only: { answer: ['reply'] } },
    { A: '!stop', only: { answer: ['stop'] }, expect: { ctl: { cmd: 'stop' }, noButtonsLeft: true } },
    { A: { tap: '1' }, only: { answer: ['tap'] }, expect: { ctl: { cmd: 'steer', match: /On submit/ }, edited: { match: /chose/ }, noButtonsLeft: true } },
    { advance: 'turn', wait: 'turn_end', only: { answer: ['tap'] }, expect: { postCount: { match: /<@UA> chose/, n: 1 } } },
  ],
  judge: 'Once A answered or stopped, no answer buttons stay that would send a stale answer.',
};
