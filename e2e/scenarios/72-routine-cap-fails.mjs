export default {
  title: 'Routines: a run that meets the session cap at its start fails at once as no runner free, and never waits in line',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr-only.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_ROUTINE_TASK_FAIL: '4 sessions running, cap 4 (FXA_SESSION_MAX)' },
  steps: [
    { root: /^Code review(?: \(routine for FxA\) started|: failed\.)/, wait: { text: /^Code review failed: no runner free/ }, expect: {
      calls: { method: 'chat.postMessage', match: /"text":"Code review \(routine for FxA\) started/, n: 1 }, ctl: { cmd: 'routine', match: /"done","43","--state","failed","--reason","no runner free"\]/, n: 1 }, edited: { match: /^Code review: failed\. See the reply in this thread\.$/ }, postCount: { match: /^Code review failed: no\ runner\ free\. A team admin/, n: 1 }, noText: /Waiting for capacity|could not record/ } },
  ],
  judge: 'A routine that finds no free runner says so once and does not queue.',
};
