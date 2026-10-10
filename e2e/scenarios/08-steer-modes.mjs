export default {
  title: 'B replies without a tag under each STEER mode (catalog 11, 12)',
  matrix: { STEER: ['mention', 'owner', 'anyone'] },
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { B: 'try the other input', expect: { noPublicPost: true } },
    { advance: 'turn', wait: 'turn_end' },
    { advance: 'turn' }, // the second turn: only STEER=anyone takes B's message
  ],
  judge: 'mention: B gets a tip, no steer. owner: B learns only A can steer. anyone: the steer goes in, marked as from someone else.',
};
