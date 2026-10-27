export default {
  title: 'A PR list stops a teammate and the owner from opening a PR; a team admin opens it',
  env: { FAKE_CI_S: '0', PROFILE_ADMINS: 'fxa:UADMINX1', PROFILE_PR_USERS: 'fxa:UPRUSER1' },
  people: { A: 'owner, allowed', B: 'teammate, allowed', ADMINX1: 'team admin, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { B: { tap: 'Open PR' }, expect: { ephemeral: { to: 'B', match: /a team admin lists can open a PR/ }, noCtl: 'finish' } },
    { A: '!pr', expect: { ephemeral: { to: 'A', match: /a team admin lists can open a PR/ }, noCtl: 'finish' } },
    // Diff is the owner's button; the admin takes it over.
    { ADMINX1: { tap: 'Diff' }, expect: { ctl: { cmd: 'diff', n: 1 } } },
    { ADMINX1: { tap: 'Open PR' }, expect: { ctl: { cmd: 'finish', n: 1 } } },
  ],
  judge: 'B and A are told who can open a PR; the admin opens it.',
};
