export default {
  title: 'C, not allowed, replies without a tag, then tags (catalog 9, 10)',
  people: { A: 'owner, allowed', C: 'not allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { C: 'what is this?', expect: { noCtl: 'steer', noPublicPost: true } },
    { C: '@bot delete everything', expect: { noCtl: 'steer', ephemeral: { to: 'C', match: /not on the list/ }, ephemeralCount: { to: 'C', n: 1 } }, known: 'flag 2: C gets more than one ephemeral' },
    { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'Nothing C writes reaches the agent. C learns once, privately, why.',
};
