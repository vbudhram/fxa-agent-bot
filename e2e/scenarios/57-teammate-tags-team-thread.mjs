export default {
  title: 'A, not on the monitor team, starts a plain thread; B, who is, tags the bot with team:monitor and owns the session',
  people: { A: 'starter, allowed', B: 'teammate, allowed' },
  env: { PROFILE_USERS: 'monitor:UB' },
  steps: [
    { A: 'the blur on the verify input looks off' },
    { B: '@bot team:monitor can you fix this?', expect: { ctl: { cmd: 'task', match: /--owner","UB/ } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'The session belongs to B, who may start the monitor team; A is not on it, so A does not own it, and nobody sees "is not on the monitor team".',
};
