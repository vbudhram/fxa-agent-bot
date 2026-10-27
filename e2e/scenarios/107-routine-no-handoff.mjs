export default {
  title: 'Routines: a wrap-up where the agent writes no handoff ends the run as no change, not failed',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr-only.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_FINISH_FAIL: 'I wrote no handoff, so nothing was pushed (my reason is above)', FAKE_WRAP_REPLY: 'There is nothing to open: the check fails on main too.' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /Wrapping up/ }, expect: { ctl: { cmd: 'finish', n: 1 } } },
    { advance: 'finish', wait: { text: /^Code review: no issue to fix\. Next run: / }, expect: {
      ctl: { cmd: 'routine', match: /"done","43","--state","nochange"/, n: 1 }, ctlOrder: [/"routine","done","43"/, /^\["stop"/] } },
  ],
  judge: 'When the agent decides there is nothing to ship, the run says no change and posts no failure.',
};
