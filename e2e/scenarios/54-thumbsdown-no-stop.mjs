export default {
  title: 'B puts 👎 on the status, and the interrupt fails: B is told the reply may still finish',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  env: { FAKE_INTERRUPT_FAILS: '1' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { B: { react: '-1', on: 'status' }, expect: { ctl: { cmd: 'interrupt', n: 1 }, ephemeral: { to: 'B', match: /Muted\. I could not stop the current reply/ }, noEphemeral: 'A' } },
    { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'B learns that the mute held but the reply could not be stopped, and is not told it stopped.',
};
