export default {
  title: 'A quick look with no new step edits its status only for the 15 s clock, not every 3 s',
  env: { QUICK_ANSWERS: '1', FAKE_ANSWER_S: '16', FAKE_ANSWER: 'It does not any more: a recent commit removed the blur check.' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot why does the verify code input validate on blur?', wait: { text: /removed the blur check/ }, expect: { calls: { method: 'chat.update', match: /Working for A/, n: 1 } } },
    { advance: 1 }, { advance: 1, expect: { reaction: { on: 'last:A', name: 'white_check_mark', not: 'eyes' } } },
  ],
  judge: 'The status moves on its clock about every 15 s, and the answer takes its place.',
};
