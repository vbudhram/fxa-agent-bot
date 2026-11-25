// Open PR tapped on an older row while the next turn runs: no raw controller refusal and no error.
// The ship waits for the turn to end ready, then runs once, as a ship after a resume does.
export default {
  title: 'Open PR tapped during a turn ships when the turn ends, with no mid-turn refusal',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: 'also check the label colour', expect: { ctl: { cmd: 'steer', match: /label colour/ } } },
    { A: { tap: 'Open PR' }, expect: { ephemeral: { to: 'A', match: /When I finish, I will/ }, noCtl: 'finish', noText: /mid-turn or not ready/ } },
    { advance: 'turn', wait: 'turn_end', expect: { ctl: { cmd: 'finish', n: 1 } } },
    { advance: 'finish', wait: { text: /pull\/999999/ } },
  ],
  judge: 'One tap is enough: the bot says it will open the PR after the turn, and then does.',
};
