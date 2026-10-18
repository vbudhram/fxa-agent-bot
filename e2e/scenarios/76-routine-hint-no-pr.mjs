export default {
  title: 'Routines: a tag in a pr routine thread that opened no PR gets the report hint, not the PR hint',
  people: { A: 'engineer, allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr-only.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_CHANGES: '0' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /^Code review: no issue to fix\. Next run: / } },
    { A: '@bot fix the rest too', expect: { ephemeral: { to: 'A', match: /^This thread holds a routine's report\. To work on a finding, tag me in a new thread and paste the finding\.$/ },
      ephemeralCount: { to: 'A', n: 1 }, noCtl: 'steer' } },
  ],
  judge: 'The hint matches what the run did: no PR, so it points to the report.',
};
