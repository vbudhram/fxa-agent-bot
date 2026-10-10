export default {
  title: '!stack while a session runs (catalog 36)',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { A: '!stack', expect: { ephemeral: { to: 'A', match: /running session/ }, noPublicPost: true } },
    { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'A learns privately to stop first or use a new thread.',
};
