export default {
  title: 'A, not on the monitor team, gets a quick answer; B, who is, picks the monitor team and tags the bot: B owns the session',
  env: { QUICK_ANSWERS: '1', FAKE_ANSWER: 'Ready when you are. What would you like to test?', PROFILE_USERS: 'monitor:UB' },
  people: { A: 'starter, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot lets test some things', wait: { text: /Ready when you are/ } },
    { B: '!stack', wait: { text: /Pick a team/ } },
    { B: { pick: 'monitor' }, wait: { buttons: /Use these/ } },
    { B: { tap: 'Use these' } },
    { B: '@bot what is in it?', expect: { ctl: { cmd: 'task', match: /--owner","UB/ } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'The tag starts a monitor session that B owns; A, not on the team, does not own it, and nobody sees "is not on the monitor team".',
};
