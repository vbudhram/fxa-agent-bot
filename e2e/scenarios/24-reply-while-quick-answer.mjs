export default {
  title: 'A asks a question, adds a detail during the quick look, and the quick look answers both (live dev thread)',
  env: { QUICK_ANSWERS: '1', FAKE_ANSWER_S: '4', FAKE_ANSWER: 'It does not any more: a recent commit removed the blur check.' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot why does the verify code input validate on blur?' },
    { A: 'it happens on mobile Safari too', expect: { reaction: { on: 'self', name: 'eyes' } }, wait: { text: /removed the blur check/ } },
    { advance: 1, expect: { noCtl: 'task' } },
    { advance: 1, expect: { reaction: { on: 'last:A', name: 'white_check_mark', not: 'eyes' }, postCount: { match: /removed the blur check/, n: 2 } } },
  ],
  judge: 'A gets the answer, and the detail sent during the look gets its own answer, not silence. No sandbox starts for a question.',
};
