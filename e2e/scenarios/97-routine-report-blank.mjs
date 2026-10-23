export default {
  title: 'Routines: a report-mode run whose report is blank says so, posts no empty report, and its end line does not claim one',
  people: { A: 'allowed' },
  tape: 'tapes/routine-report-blank.json',
  env: { FAKE_ROUTINES: 'e2e/routines/report.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', E2E_CHANNELS: JSON.stringify({ C_TEST: { is_private: true } }) },
  steps: [
    { root: /^Security review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /^Security review: the run ended with no report\. No code changed\./ }, expect: {
      ctl: { cmd: 'routine', match: /"done","42"/, n: 1 } } },
    { expect: { ctl: { cmd: 'finish', n: 0 }, postCount: { match: /the report is in this thread/, n: 0 } } },
  ],
  judge: 'A blank report is not posted, and the end line says the run ended with no report.',
};
