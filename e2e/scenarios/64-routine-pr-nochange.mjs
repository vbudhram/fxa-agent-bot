export default {
  title: 'Routines: a pr run whose turn ends with no change does not ship, and says there was nothing to fix',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr-only.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_CHANGES: '0' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /^Code review: no issue to fix\. Next run: / }, expect: {
      ctl: { cmd: 'routine', match: /"done","43","--state","nochange"/, n: 1 }, ctlOrder: [/"routine","done","43"/, /^\["stop"/] } },
    { expect: { ctl: { cmd: 'finish', n: 0 } } },
  ],
  judge: 'With nothing to fix the run says so and opens no PR.',
};
