export default {
  title: 'Routines: a pr+notes run that fixes nothing and lists nothing says there was nothing to fix',
  people: { A: 'allowed' },
  tape: 'tapes/routine-notes-blank.json',
  env: { FAKE_ROUTINES: 'e2e/routines/pr.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_CHANGES: '0' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /^Code review: no issue to fix\. Next run: / }, expect: {
      ctl: { cmd: 'routine', match: /"done","41","--state","nochange"/, n: 1 } } },
    { expect: { ctl: { cmd: 'finish', n: 0 } } },
  ],
  judge: 'With nothing fixed and nothing listed, the run says so in one line and opens no PR.',
};
