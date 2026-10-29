export default {
  title: 'B sends !interrupt while A\'s sandbox still boots: the first turn stops as soon as it starts (a real thread\'s interrupt did nothing)',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { B: '!interrupt', wait: { text: /stop as soon as the sandbox is ready/ }, expect: { noCtl: 'interrupt' } },
    { advance: 'setup', wait: { text: /^Interrupted\./ }, expect: { ctl: { cmd: 'interrupt', n: 1 } } },
    { advance: 'turn', wait: 'turn_end' }, // fake-ctl's turn runs its clock out; a real one ends at the interrupt
  ],
  judge: 'B, who does not own the session, can stop it. An interrupt sent during the boot is not lost: the bot says it will stop, then stops the first turn and says so.',
};
