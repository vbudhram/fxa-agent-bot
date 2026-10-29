export default {
  title: 'B is allowed in the channel but not on the monitor team: B cannot steer or resume A\'s monitor session, but can interrupt it',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  env: { PROFILE_USERS: 'monitor:UA' },
  steps: [
    { A: '@bot team:monitor look at the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { B: '@bot also read the secrets file', expect: { noCtl: 'steer' } },
    { B: '!interrupt', expect: { ctl: { cmd: 'interrupt', n: 1 } } },
    { A: '!pause', expect: { ctl: { cmd: 'session', match: /pause/ } } },
    { B: '@bot finish it please', expect: { noCtl: 'task' } },
    { B: 'finish it please', expect: { noCtl: 'task' } },
    { A: '@bot now also fix the label', expect: { ctl: { cmd: 'task', match: /resume-from/, n: 1 } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'Only people on the monitor team drive its session. B, who is not, cannot steer or continue it, but may interrupt a turn, which reads and changes nothing; A still drives it.',
};
