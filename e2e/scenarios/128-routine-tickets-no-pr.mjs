export default {
  title: 'Routines: a tickets-mode run whose turn changed files opens no PR, and ends as a report for ctl to file',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/tickets.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { ctl: /"routine","done","43"/ }, expect: {
      ctl: { cmd: 'routine', match: /"done","43","--state","report"/, n: 1 }, noCtl: 'finish' } },
  ],
  judge: 'The run ends as a report: no wrap-up, no PR.',
};
