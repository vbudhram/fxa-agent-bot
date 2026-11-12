// The agent writes 'ship: pr' after every finished change. An owner off the PR list who asked only for a fix
// gets the ready reply with its buttons for someone on the list, not a refusal for a PR they never asked for.
export default {
  title: 'A finished change from an owner off the PR list: no PR refusal, no PR, the buttons stay',
  tape: 'tapes/ship-on-ask.json',
  env: { PROFILE_PR_USERS: 'fxa:UPRUSER1' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: 'also make the label bold' },
    { advance: 'turn', wait: 'turn_end' },
    { pause: 3, expect: { postCount: { match: /a team admin lists can open a PR/, n: 0 }, ctl: { cmd: 'finish', n: 0 } } },
  ],
  judge: 'A sees the reply and the buttons; no refusal and no PR.',
};
