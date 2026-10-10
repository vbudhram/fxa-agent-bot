export default {
  title: 'B tries !stack and !stack checkout in A\'s paused session (review finding)',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!pause', expect: { ctl: { cmd: 'session', match: /pause/ } } },
    { B: '!stack', expect: { ephemeral: { to: 'B', match: /Only they can pick a stack/ } } },
    { B: '!stack checkout https://github.com/mozilla/fxa/pull/1', expect: { ephemeral: { to: 'B', match: /Only they can pick a stack/ }, noCtl: 'task' } },
  ],
  judge: 'B cannot replace A\'s paused session with a stack pick or a checkout, and is told why, privately. A\'s session stays.',
};
