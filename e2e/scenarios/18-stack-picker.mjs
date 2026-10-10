export default {
  title: 'A picks a team stack; B taps A\'s picker; A starts with those repos (catalog 34)',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot !stack', wait: { text: /Pick a team/ } },
    { B: { pick: 'PyFxA team' }, expect: { ephemeral: { to: 'B', match: /Only <@UA> can use this picker/ } } },
    { A: { pick: 'PyFxA team' }, wait: { buttons: /Use these/ } },
    { A: { tap: 'Use these' }, expect: { edited: { match: /PyFxA team/ } } },
    { A: '@bot make the live tests read the URL from env', expect: { ctl: { cmd: 'task', match: /--repos\",\"mozilla\/PyFxA,mozilla\/fxa/ } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end', expect: { text: /Fake turn 1/ } },
  ],
  judge: 'The picker is A\'s alone. The team card says which repo ships a diff and which a PR. The turn has a Diff row per repo and a PR row only for fxa.',
};
