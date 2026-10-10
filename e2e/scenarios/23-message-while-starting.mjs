export default {
  title: 'A adds a detail and B a note during the quick look (a real dev thread lost an early "@bot ^")',
  env: { QUICK_ANSWERS: '1', FAKE_ANSWER_S: '5' },
  matrix: { order: ['message_first', 'mention_first'] },
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot why does the verify code input lose focus on blur?' },
    { A: 'it happens on mobile too', expect: { reaction: { on: 'self', name: 'eyes' }, noCtl: 'task' } },
    { B: '@bot and when you paste a code', wait: { text: /./ } },
    { advance: 'setup', expect: { ctl: { cmd: 'task', match: /lose focus on blur.*mobile too.*someone else.*paste a code/s, n: 1 } } },
    { advance: 'setup' }, // the session started after the quick look, so its boot starts later on the fake clock
    { advance: 'turn', wait: 'turn_end', expect: { reaction: { on: 'last:B', name: 'white_check_mark' } } },
  ],
  judge: 'Both early messages reach the agent with the question, and each gets ✅ with the reply. One session starts.',
};
