export default {
  title: 'Routines: the end text follows routine done: a held report, a store error, and a run that had ended',
  people: { A: 'allowed' },
  tape: 'tapes/routine-report.json',
  matrix: { FAKE_ROUTINE_DONE: ['', 'fail', 'stopped'] },
  env: { FAKE_ROUTINES: 'e2e/routines/report.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_ROUTINE_POST: 'false', E2E_CHANNELS: JSON.stringify({ C_TEST: { is_private: true } }) },
  steps: [
    { root: /^Security review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { advance: 'turn', only: { FAKE_ROUTINE_DONE: [''] }, wait: { text: /^Security review: the report holds data I do not post in Slack\./ } },
    { advance: 'turn', only: { FAKE_ROUTINE_DONE: ['fail'] }, wait: { text: /^Security review: I could not record this run's result, so I post nothing from it\./ } },
    { advance: 'turn', only: { FAKE_ROUTINE_DONE: ['stopped'] }, wait: { text: /^Security review stopped by a team admin\./ } },
    { expect: { postCount: { match: /account route logs the session token/, n: 0 }, ctl: { cmd: 'stop', n: 1 } } },
    { only: { FAKE_ROUTINE_DONE: ['fail', 'stopped'] }, expect: { postCount: { match: /holds data/, n: 0 } } },
  ],
  judge: 'The report reaches Slack only when ctl recorded it and its scan passed; every other end says plainly what happened.',
};
