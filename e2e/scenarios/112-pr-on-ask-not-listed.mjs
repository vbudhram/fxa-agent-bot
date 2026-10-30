export default {
  title: 'An owner who is not on the PR list asks for the PR in words: the bot refuses as for !pr and opens nothing',
  tape: 'tapes/ship-on-ask.json',
  env: { PROFILE_PR_USERS: 'fxa:UPRUSER1' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: 'looks good, open a PR' },
    { advance: 'turn', wait: { text: /a team admin lists can open a PR/ }, expect: { noCtl: 'finish' } },
  ],
  judge: 'A is told who can open a PR, and no PR opens.',
};
