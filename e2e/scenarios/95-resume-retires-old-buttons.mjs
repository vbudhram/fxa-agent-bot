export default {
  title: 'After a resume in the same thread, only the newest reply keeps its buttons',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end', expect: { buttonRows: 1 } },
    { A: '!pause' },
    { A: '@bot keep going', expect: { ctl: { cmd: 'task', match: /resume-from/, n: 1 } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end', expect: { buttonRows: 1 } },
  ],
  judge: 'An older Diff or Open PR row cannot act on a state the thread has moved past.',
};
