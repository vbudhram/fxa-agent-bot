export default {
  title: 'A asks a question, gets a quick answer, then follows up, tagged or not',
  env: { QUICK_ANSWERS: '1', FAKE_ANSWER: 'The verify code input checks the code on submit only.' },
  matrix: { reply: ['tagged', 'untagged'], order: ['message_first', 'mention_first'] },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot why does the verify code input validate on blur?', wait: { text: /on submit only/ } },
    { A: '@bot and on paste?', only: { reply: ['tagged'] }, wait: { text: /./ } },
    { A: 'and on paste?', only: { reply: ['untagged'] }, wait: { text: /./ } },
    { advance: 1, expect: { ctl: { cmd: 'answer', n: 2 }, postCount: { match: /on submit only/, n: 2 }, noCtl: 'task' } },
  ],
  judge: 'Each question gets one answer. No second answer for one follow-up.',
};
