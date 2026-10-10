export default {
  title: 'A steers without a tag while a turn runs (catalog 2)',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { A: 'use the shared helper instead', expect: { ctl: { cmd: 'steer', match: /shared helper/ } } },
    { advance: 'turn' }, { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'The steer is acknowledged without noise, and both of A\'s messages end with ✅.',
};
