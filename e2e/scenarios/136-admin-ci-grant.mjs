export default {
  title: "A team admin's request lets the session ship CI config; another person's does not",
  env: { PROFILE_ADMINS: 'fxa:UADMINX1' },
  people: { A: 'owner, allowed', ADMINX1: 'team admin, allowed' },
  steps: [
    { A: '@bot bump the Node image in CircleCI', expect: { noCtl: { cmd: 'task', match: /--ci-ok/ } } },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    // The admin's message in the owner's thread grants it for the rest of the session.
    { ADMINX1: '@bot go ahead and change .circleci too', expect: { ctl: { cmd: 'steer', match: /--ci-ok/ } } },
    { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: '@bot thanks', expect: { noCtl: { cmd: 'steer', match: /--ci-ok/ } } },
    { advance: 'turn', wait: { buttons: /Open PR/ } },
    { ADMINX1: '@bot bump the Node image in CircleCI', thread: 'T2', expect: { ctl: { cmd: 'task', match: /--ci-ok/, thread: 'T2' } } },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
  ],
  judge: "Only the admin's start and the admin's message carry --ci-ok.",
};
