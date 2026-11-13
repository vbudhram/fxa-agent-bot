// !stack checkout in a thread with a live one-repo session: a team admin's checkout adds the PR as a target
// (a steer with their words), and starts no second session.
export default {
  title: "A team admin's !stack checkout in a live thread adds the PR as a target, with no new session",
  env: { PROFILE_ADMINS: 'fxa:UADMINX1' },
  people: { A: 'owner, allowed', ADMINX1: 'team admin, allowed' },
  steps: [
    { A: '@bot fix the offset limit 0 case' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { ADMINX1: '!stack checkout https://github.com/mozilla/fxa/pull/2738',
      expect: { ctl: { cmd: 'steer', match: /Work on https:\/\/github.com\/mozilla\/fxa\/pull\/2738.*admin-words-file.*work on https:\/\/github.com\/mozilla\/fxa\/pull\/2738/s }, noCtl: 'task' } },
  ],
  judge: 'The admin checks out PR 2738 in the live thread. The bot steers the session to work on it, with the admin words, and starts no new session.',
};
