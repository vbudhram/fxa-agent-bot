export default {
  title: 'B talks without a tag during A\'s quick look (review finding)',
  env: { QUICK_ANSWERS: '1', FAKE_ANSWER_S: '5' },
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot why does the verify code input lose focus on blur?' },
    { B: 'lunch at noon?', wait: { text: /./ } },
    { advance: 'setup' }, { advance: 'setup' },
    { advance: 'setup' }, // the session starts after the quick look, so its boot starts later on the fake clock
    { advance: 'turn', wait: 'turn_end', // one task, with A's question and without B's chat (n counts every call, so the start is in it)
      expect: { ctl: { cmd: 'task', match: /^(?![\s\S]*lunch)[\s\S]*lose focus on blur/, n: 1 } } },
  ],
  judge: 'B\'s untagged chat is not an instruction to A\'s session. One session starts on A\'s question.',
};
