// Once the PR is open, the verb is Update PR: !push updates the PR, and no row offers Push branch.
export default {
  title: 'After Open PR, A sends !push: it updates the PR, as Update PR does',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: { tap: 'Open PR' } },
    { advance: 'finish', wait: { text: /pull\/999999/ } },
    { A: 'also check the label colour' },
    { advance: 'turn', wait: { buttons: /Update PR/ }, expect: { buttons: { match: /Fake turn 2/, none: /push_branch/ } } },
    { A: '!push', expect: { ctl: { cmd: 'finish', n: 2 }, noCtl: { cmd: 'finish', match: /--no-pr/ }, noText: /Pushing the branch/ } },
  ],
  judge: 'After the PR is open, nothing says Push branch; !push updates the PR.',
};
