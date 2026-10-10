export default {
  title: 'A talks to B, then tags both (catalog 7, 8)',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '@B can you check prod?', expect: { noCtl: 'steer', noPublicPost: true } },
    { A: '@B @bot try fix 2', expect: { ctl: { cmd: 'steer', match: /try fix 2/ } } },
    { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'The bot stays out of the message to B, then acts on the tagged one. The aside reaches the agent as context.',
};
