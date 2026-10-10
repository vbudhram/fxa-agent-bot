export default {
  title: 'B deletes nothing of A\'s; A deletes the root and the session stops (catalog 29, 30)',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { B: 'noise' },
    { B: { del: 'last' }, expect: { noCtl: 'stop' } },
    { A: { del: 'root' }, expect: { ctl: { cmd: 'stop' } } },
  ],
  judge: 'Deleting the root ends the session quietly. No message points at a thread that is gone.',
};
