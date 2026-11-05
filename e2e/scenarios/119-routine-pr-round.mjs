// A routine's PR gets the same feedback loop as a session's: a Copilot review on it starts one
// automatic round in the routine's thread, and a tag there still gets only the PR hint (D24).
export default {
  title: 'Routines: a Copilot review on the PR a routine opened starts one round in its thread',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_CI_S: '0', FAKE_COPILOT_AT: '5' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /Wrapping up/ } },
    { advance: 'finish', wait: { ctl: /"routine","done"/ } },
    { advance: 5, wait: { ctl: /Copilot reviewed the PR/ }, expect: { text: /Copilot/, ctl: { match: /Copilot reviewed the PR/, n: 1 } } },
    // The round's turn ends, and the host updates the PR (pr_auto): a second finish.
    { advance: 'turn' },
    { pause: 3, expect: { ctl: { match: /"--resume-from"/, n: 1 } } },
    { A: '@bot can you also fix the typo', expect: { ephemeral: { to: 'A', match: /^To work on this PR, tag me in a new thread with the PR link\.$/ }, noCtl: 'steer' } },
  ],
  judge: 'The routine thread shows the Copilot round; a person tagging the bot there starts nothing.',
};
