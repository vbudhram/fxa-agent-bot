export default {
  title: 'B and C put 👎 on the status (catalog 28)',
  people: { A: 'owner, allowed', B: 'teammate, allowed', C: 'not allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { C: { react: '-1', on: 'status' }, expect: { noCtl: 'interrupt', noEphemeral: 'C' } },
    { B: { react: '-1', on: 'status' } },
    { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'C cannot stop the turn. What B\'s 👎 did is clear.',
};
