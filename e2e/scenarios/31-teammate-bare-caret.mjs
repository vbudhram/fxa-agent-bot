// Code review finding (regression from per-line labels): a teammate's bare "^" went to the agent as a steer.
export default {
  title: 'B, a teammate, sends a bare "@bot ^" while A\'s session works (review finding)',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot why does /oauth/subscriptions/active reject a session token?' },
    { advance: 'setup' },
    { B: '@bot ^', expect: { noCtl: 'steer' } }, // it points at what the turn already answers: no steer
    { advance: 'turn', wait: 'turn_end', expect: { postCount: { match: /Fake turn/, n: 1 } } },
  ],
  judge: 'B\'s "^" adds nothing new: it gets no steer and no second reply.',
};
