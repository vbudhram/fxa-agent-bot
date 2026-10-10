export default {
  title: 'B tags to resume A\'s paused session (catalog 21)',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!pause' },
    { B: '@bot finish it please', expect: { ctl: { cmd: 'task', match: /resume-from.*someone else.*finish it please/s, n: 1 } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { B: { tap: 'Open PR' }, expect: { ephemeral: { to: 'B', match: /Only <@UA>/ }, noCtl: 'finish' } },
  ],
  judge: 'B can continue the work, but A stays the owner and keeps the buttons.',
};
