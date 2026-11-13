// A thread holds several targets (the controller's lib/targets.sh): after a team admin's switch, one card
// lists them, the follower reads the new PR, and the old PR's close ends only its own target.
export default {
  title: "A team admin's switch to PR 2738: one targets card, and the old PR's close ends only its target",
  tape: 'tapes/target-switch.json',
  env: { PROFILE_ADMINS: 'fxa:UADMINX1', FAKE_TARGET_STATE: 'CLOSED' },
  people: { A: 'owner, allowed', ADMINX1: 'team admin, allowed' },
  steps: [
    { A: '@bot fix the offset limit 0 case' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: { tap: 'Open PR' } }, { advance: 'finish', wait: { text: /pull\/999999/ } },
    { ADMINX1: '@bot put the offset-limit-0 commit on PR 2738', expect: { ctl: { cmd: 'steer', match: /admin-words-file/ } } },
    { advance: 'turn', wait: { text: /ended \(closed\)/ },
      expect: { text: /PR 2738> `stor-55` · current/, postCount: { match: /This thread's work/, n: 1 },
        ctl: { cmd: 'session', match: /target-end","agent-[a-z0-9]+","https:\/\/github.com\/mozilla\/fxa\/pull\/999999","CLOSED"/, n: 1 }, noCtl: 'stop' } },
  ],
  judge: 'The admin switches the work to PR 2738. One card lists PR 2738 as current and PR 999999. Its close marks it ended, and the session stays.',
};
