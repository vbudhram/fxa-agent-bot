export default {
  title: 'A restarts a PyFxA team session: the new session is still a PyFxA team session, not FxA',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot team:pyfxa-team fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!restart', expect: { ctl: { cmd: 'task', team: 'pyfxa-team', n: 2 } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
  ],
  judge: '!restart starts a new conversation in the same team, with the same repos.',
};
