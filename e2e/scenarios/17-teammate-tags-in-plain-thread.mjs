export default {
  title: 'A starts a plain thread, B tags the bot in it (catalog 32)',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: 'the blur on the verify input looks off' },
    { B: '@bot can you fix this?', expect: { ctl: { cmd: 'task', match: /--owner\",\"UA/ } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { B: { tap: 'Open PR' }, expect: { ephemeral: { to: 'B', match: /Only <@UA>/ } } },
  ],
  judge: 'The thread starter owns the session. B is told who can ship.',
};
