export default {
  title: 'A tags the bot, then sends a bare "@bot ^" while it works; later a "^" after a new note (real Firefox threads)',
  matrix: { order: ['message_first', 'mention_first'] },
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot why does /oauth/subscriptions/active reject a session token?' },
    { advance: 'setup' },
    { A: '@bot ^', expect: { noCtl: 'steer' } },
    { advance: 'turn', wait: 'turn_end', expect: { reaction: { on: 'last:A', name: 'white_check_mark' }, postCount: { match: /Fake turn/, n: 1 } } },
    { B: 'it also fails on stage' },
    { A: '@bot ^', expect: { ctl: { cmd: 'steer', match: /also fails on stage/ } } },
    { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'The first "^" adds nothing new, so it gets no second reply; the second one carries B\'s note.',
};
