export default {
  title: 'A asks for a team stack; B uses the picker and owns the pick; B\'s tag starts with those repos (catalog 34)',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot !stack', wait: { text: /Pick a team/ } },
    { B: { pick: 'PyFxA team' }, wait: { buttons: /Use these/ } },
    { B: { tap: 'Use these' }, expect: { edited: { match: /PyFxA team/ } } },
    { B: '@bot make the live tests read the URL from env', expect: { ctl: { cmd: 'task', match: /--repos\",\"mozilla\/PyFxA,mozilla\/fxa/ } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end', expect: { text: /Fake turn 1/ } },
  ],
  judge: 'Anyone in the thread may use the picker, and the one who uses it owns the pick. The team card says which repo ships a diff and which a PR. The turn has a Diff row per repo and a PR row only for fxa.',
};
