export default {
  title: 'B sends !pause, then !interrupt, in A\'s session (catalog 20)',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { B: '!pause', expect: { ephemeral: { to: 'B', match: /Only <@UA>/ }, noCtl: { cmd: 'session', match: /pause/ } } },
    { B: '!interrupt' },
    { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'B cannot pause A\'s session and is told why, privately. Interrupt behavior is clear to everyone.',
};
