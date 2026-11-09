// Copilot reviews the PR the bot opened: one automatic round starts, and the same review starts no
// second one. The team's review_rounds (2 by default) counts only large fixes: these small rounds
// never reach it, so the third review starts its round with no tap (a real thread lost 49 minutes there).
// The round's note becomes its status and then its result: one message for each round.
export default {
  title: 'Copilot reviews the PR: one round per review, and small rounds need no tap',
  env: { FAKE_CI_S: '0', FAKE_COPILOT_AT: '5 200 400' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: { tap: 'Open PR' } },
    { advance: 'finish', wait: { text: /pull\/999999/ } },
    // Wait for the round's controller call: its card can come first on a slow machine.
    { advance: 5, wait: { ctl: /Copilot reviewed the PR/ }, expect: { ctl: { match: /Copilot reviewed the PR/, n: 1 } } },
    // The round's turn ends in its note's message; the same review on later looks starts no second round.
    { advance: 'turn', wait: 'turn_end', expect: { postCount: { match: /Copilot left/, n: 0 } } },
    { pause: 3, expect: { ctl: { match: /Copilot reviewed the PR/, n: 1 } } },
    { advance: 200, wait: { ctl: /Copilot reviewed the PR/ }, expect: { ctl: { match: /Copilot reviewed the PR/, n: 2 } } },
    { advance: 'turn', wait: 'turn_end', expect: { postCount: { match: /Copilot left/, n: 0 } } },
    // A third review: small rounds do not count toward the cap, so it starts with no Fix it button.
    { advance: 200, wait: { ctl: /Copilot reviewed the PR/ }, expect: { ctl: { match: /Copilot reviewed the PR/, n: 3 } } },
    { advance: 'turn', wait: 'turn_end', expect: { noText: /I already pushed/ } },
  ],
  judge: 'One round per Copilot review, in one message each; small rounds never ask for a tap.',
};
