export default {
  title: 'Routines: a run whose task ctl refuses ends as failed with the reason, through routine done with no session',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr-only.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_ROUTINE_TASK_FAIL: 'routine run 43 is started, not claimed' },
  steps: [
    { root: /^Code review(?: \(routine for FxA\) started|: failed\.)/, wait: { text: /^Code review failed: routine run 43 is started, not claimed/ }, expect: {
      calls: { method: 'chat.postMessage', match: /"text":"Code review \(routine for FxA\) started/, n: 1 }, ctl: { cmd: 'routine', match: /"done","43","--state","failed","--reason","routine run 43 is started, not claimed"\]/, n: 1 }, edited: { match: /^Code review: failed\. See the reply in this thread\.$/ }, postCount: { match: /^Code review failed: routine\ run\ 43\ is\ started,\ not\ claimed\. A team admin/, n: 1 }, noText: /could not record/ } },
  ],
  judge: 'A run that ctl refuses says why, once, and records the failure.',
};
