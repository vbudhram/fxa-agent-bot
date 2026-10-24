export default {
  title: 'Dependency fix: a push refused because the branch moved says so with the retry step, and never names a report or the error text',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/fix-moved.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_FINISH_FAIL: 'lease mismatch on refs/heads/dependabot-x' },
  steps: [
    { root: /^Dependency fix for <https:\/\/github\.com\/mozilla\/fxa\/pull\/90001\|#90001>: label by octocat\.$/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { ctl: /"finish"/ } },
    { advance: 'finish', wait: { text: /^The branch of / }, expect: {
      postCount: { match: /^The branch of <https:\/\/github\.com\/mozilla\/fxa\/pull\/90001\|#90001> moved, so nothing was pushed\. Add agent-help again to retry\.$/, n: 1 },
      edited: { match: /^Dependency fix for <[^>]+>: branch moved\.$/ },
      ctl: { cmd: 'routine', match: /"done","101","--state","failed"/, n: 1 } } },
    { expect: { postCount: { match: /report|lease mismatch|failed/i, n: 0 } } },
  ],
  judge: 'A moved branch is said plainly with the step to retry; no raw error and no mention of a report.',
};
