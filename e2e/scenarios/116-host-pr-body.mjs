export default {
  title: 'Host write: words that do not name the action need a confirm; the admin\'s typed yes updates the PR description',
  env: { QUICK_ANSWERS: '1', FXA_CTL: 'e2e/tools/host-ctl.sh', PROFILE_ADMINS: 'fxa:UADMINX1', FAKE_ANSWER: 'Here is a new description.', FAKE_HOST_RESULT: 'confirm',
    FAKE_HOST_WRITE: '{"op":"pr-body","url":"https://github.com/mozilla/fxa/pull/42","body":"## Because\\n\\n- The sign-in timed out."}' },
  people: { ADMINX1: 'team admin, allowed' },
  steps: [
    { ADMINX1: '@bot can you tidy up mozilla/fxa#42?', wait: { text: /PR description/ },
      expect: { ctl: { cmd: 'session', match: /"host-write","agent-[a-z0-9]+","--stdin","--by","UADMINX1","--words"/, n: 1 } } },
    { ADMINX1: 'yes', wait: { text: /Updated the PR description on <https:\/\/github\.com\/mozilla\/fxa\/pull\/42\|mozilla\/fxa#42>/ },
      expect: { ctl: { cmd: 'session', match: /"--confirmed"/, n: 1 } } },
  ],
  judge: 'The first look shows the new description on a card. The admin\'s yes in the thread applies it once and says so with the link.',
};
