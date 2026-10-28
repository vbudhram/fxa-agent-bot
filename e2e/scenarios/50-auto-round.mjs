// Copilot reviews the PR the bot opened: one automatic round starts, the same review starts no
// second one, and a review past the team's review_rounds (2 by default) asks with a Run a round button.
export default {
  title: 'Copilot reviews the PR: one round per review, and the third asks with Run a round',
  env: { FAKE_CI_S: '0', FAKE_COPILOT_AT: '5 200 400' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: { tap: 'Open PR' } },
    { advance: 'finish', wait: { text: /pull\/999999/ } },
    // Wait for the round's controller call: its card can come first on a slow machine.
    { advance: 5, wait: { ctl: /Copilot reviewed the PR/ }, expect: { text: /Copilot/, ctl: { match: /Copilot reviewed the PR/, n: 1 } } },
    // The round's turn ends; the same review on later looks starts no second round.
    { advance: 'turn', wait: 'turn_end' },
    { pause: 3, expect: { ctl: { match: /Copilot reviewed the PR/, n: 1 } } },
    { advance: 200, wait: { ctl: /Copilot reviewed the PR/ }, expect: { text: /Copilot left 1 comment/, ctl: { match: /Copilot reviewed the PR/, n: 2 } } },
    { advance: 'turn', wait: 'turn_end' },
    // Past the 2 rounds: the bot asks, and starts nothing.
    { advance: 200, wait: { buttons: /Run a round/ }, expect: { ctl: { match: /Copilot reviewed the PR/, n: 2 } } },
  ],
  judge: 'One round per Copilot review; past the limit the bot asks instead of starting another.',
};
