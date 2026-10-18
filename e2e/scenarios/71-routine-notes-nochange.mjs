export default {
  title: 'Routines: a pr+notes run that fixes nothing posts its Not fixed findings, and does not say there was nothing to fix',
  people: { A: 'allowed' },
  tape: 'tapes/routine-notes.json',
  env: { FAKE_ROUTINES: 'e2e/routines/pr.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_CHANGES: '0' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /^Code review: the report is in this thread\. No code changed\./ }, expect: {
      text: /Not fixed:\n- The account route logs the session token/,
      ctl: { cmd: 'routine', match: /"done","41","--state","report","--session","agent-[a-z0-9]+","--report-file"/, n: 1 } } },
    { expect: { ctl: { cmd: 'finish', n: 0 }, noText: /no issue to fix/ } },
  ],
  judge: 'The findings the run did not fix reach the channel, and no PR opens.',
};
