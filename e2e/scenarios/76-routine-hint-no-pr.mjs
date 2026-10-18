export default {
  title: 'Routines: a tag in a live pr routine thread gets the PR hint; once the run opened no PR, the report hint',
  people: { A: 'engineer, allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr-only.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_CHANGES: '0' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { A: '@bot is this done yet', expect: { ephemeral: { to: 'A', match: /^To work on this PR, tag me in a new thread with the PR link\.$/ },
      ephemeralCount: { to: 'A', n: 1 }, noCtl: 'steer' } },
    { advance: 'turn', wait: { text: /^Code review: no issue to fix\. Next run: / } },
    { A: '@bot fix the rest too', expect: { ephemeral: { to: 'A', match: /^This thread holds a routine's report\. To work on a finding, tag me in a new thread and paste the finding\.$/ },
      ephemeralCount: { to: 'A', n: 2 }, noCtl: 'steer' } },
  ],
  judge: 'The hint matches what the run did: no PR, so it points to the report.',
};
