export default {
  title: 'B replies without a tag twice, then tags the bot (catalog 3, 4, 5)',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' },
    { B: 'lgtm?', expect: { ephemeral: { to: 'B', match: /This is <@UA>'s session/ }, noCtl: 'steer', noPublicPost: true } },
    { B: 'also check mobile', expect: { ephemeralCount: { to: 'B', n: 1 }, noCtl: 'steer' } },
    { B: '@bot use approach 2', expect: { ctl: { cmd: 'steer', match: /someone else.*use approach 2/s } } },
    { advance: 'turn' }, { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'B gets one private tip, not two. The next turn follows B\'s tagged steer. A stays the owner and keeps the buttons.',
};
