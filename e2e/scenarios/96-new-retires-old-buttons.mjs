export default {
  title: 'After !new in the same thread, only the newest reply keeps its buttons',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end', expect: { buttonRows: 1 } },
    { A: '!new start over on the focus ring', wait: { ctl: /"task"/ } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end', expect: { buttonRows: 1 } },
  ],
  judge: 'A fresh start in the thread leaves no older Diff or Open PR row that still acts.',
};
