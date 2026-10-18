export default {
  title: 'Routines: a wrap-up that fails ends the run as failed, with the History link',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr-only.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_FINISH_FAIL: 'the handoff check did not pass', DASHBOARD_URL: 'https://dash.example.com' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /Wrapping up/ }, expect: { ctl: { cmd: 'finish', n: 1 } } },
    { advance: 'finish', wait: { text: /^Code review failed: / }, expect: {
      edited: { match: /^Code review failed: the handoff check did not pass\. A team admin can see the log in the dashboard: <https:\/\/dash\.example\.com\/#team=fxa\|History>\./ },
      ctl: { cmd: 'routine', match: /"done","43","--state","failed","--session","agent-[a-z0-9]+","--reason","the handoff check did not pass"/, n: 1 },
      ctlOrder: [/"routine","done","43"/, /^\["stop"/] } },
  ],
  judge: 'A failed wrap-up is said plainly, with where an admin reads more, and the sandbox is stopped.',
};
