// A team stack has one tree per repo. Each repo's Diff and Open PR act on that tree only, at any
// time and more than once, and one repo's PR merging does not end the session: only Stop does.
export default {
  title: 'A two-repo stack: Diff on PyFxA, Open PR on fxa, the fxa PR merges, the session stays until Stop',
  env: { FAKE_CI_S: '0', FAKE_MERGE_S: '0' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot !stack', wait: { text: /Pick a team/ } },
    { A: { pick: 'PyFxA team' }, wait: { buttons: /Use these/ } },
    { A: { tap: 'Use these' } },
    { A: '@bot make the live tests read the URL from env' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR · fxa/ } },
    { A: { tap: 'Diff · pyfxa' }, expect: { ctl: { cmd: 'diff', match: /--repo","mozilla\/PyFxA"/, n: 1 } } },
    { A: { tap: 'Open PR · fxa' }, expect: { ctl: { cmd: 'finish', match: /--repo","mozilla\/fxa"/, n: 1 } } },
    { advance: 'finish', wait: { text: /mozilla\/fxa\/pull\/999999/ } },
    { advance: 1, wait: { text: /Merged/ }, expect: { noCtl: 'stop' } },
    { A: { tap: 'Diff · pyfxa' }, expect: { ctl: { cmd: 'diff', match: /--repo","mozilla\/PyFxA"/, n: 2 }, noCtl: 'stop' } },
    { A: '@bot !stop', expect: { ctl: { cmd: 'stop', n: 1 } } },
  ],
  judge: 'Each repo button acts on its own repo. The fxa PR card shows the merge, the session keeps running, and PyFxA still gives a diff. Only !stop ends it.',
};
