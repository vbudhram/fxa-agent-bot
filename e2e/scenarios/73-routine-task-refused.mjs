export default {
  title: 'Routines: a run whose task ctl refuses ends as failed with the reason, through routine done with no session',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr-only.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_ROUTINE_TASK_FAIL: 'routine run 43 is started, not claimed' },
  known: { no_double_post: 'the end text edits the start message and also goes as a broadcast reply (D22); a run that ends at its start shows both in one step' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/, wait: { text: /^Code review failed: routine run 43 is started, not claimed/ }, expect: {
      ctl: { cmd: 'routine', match: /"done","43","--state","failed","--reason","routine run 43 is started, not claimed"\]/, n: 1 }, noText: /could not record/ } },
  ],
  judge: 'A run that ctl refuses says why, once, and records the failure.',
};
