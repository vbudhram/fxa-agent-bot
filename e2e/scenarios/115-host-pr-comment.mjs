export default {
  title: 'Host write: a PR comment that a person who is not an admin asks for waits on a card; only a team admin\'s Apply posts it',
  env: { QUICK_ANSWERS: '1', FXA_CTL: 'e2e/tools/host-ctl.sh', PROFILE_ADMINS: 'fxa:UADMINX1', FAKE_ANSWER: 'Here is a comment for the PR.',
    FAKE_HOST_WRITE: '{"op":"pr-comment","url":"https://github.com/mozilla/fxa/pull/42","body":"The test covers the slow network case."}' },
  people: { A: 'owner, allowed', ADMINX1: 'team admin, allowed' },
  steps: [
    { A: '@bot write a comment on mozilla/fxa#42 about the test', wait: { text: /PR comment/ },
      expect: { ctl: { cmd: 'session', match: /"host-write","agent-[a-z0-9]+","--stdin","--by","UA","--check"/, n: 1 }, noCtl: { cmd: 'session', match: /--confirmed|--words/ } } },
    { A: { tap: 'Apply' }, expect: { ephemeral: { to: 'A', match: /Only a team admin can apply this/ }, noCtl: { cmd: 'session', match: /--confirmed/ } } },
    { ADMINX1: { tap: 'Apply' }, wait: { text: /Posted the comment on <https:\/\/github\.com\/mozilla\/fxa\/pull\/42\|mozilla\/fxa#42>/ },
      expect: { ctl: { cmd: 'session', match: /"host-write","agent-[a-z0-9]+","--stdin","--by","UADMINX1","--confirmed"/, n: 1 } } },
    { ADMINX1: { tap: 'Apply', on: 'same' }, expect: { ctl: { cmd: 'session', match: /--confirmed/, n: 1 } } },
  ],
  judge: 'The card shows the PR and the exact comment. A\'s tap posts nothing and tells A why. The admin\'s tap posts it once.',
};
