export default {
  title: 'Routines: a routine session at the sandbox time limit stops, with no pause text',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr-only.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', SESSION_MAX_MINUTES: '5' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/ },
    { advance: 'setup', wait: { text: /^Code review failed: the run reached the 5-minute limit of its sandbox\./ }, expect: {
      ctl: { cmd: 'routine', match: /"done","43","--state","failed","--session","agent-[a-z0-9]+","--reason","the run reached the 5-minute limit/, n: 1 },
      ctlOrder: [/"routine","done","43"/, /^\["stop"/] } },
    { expect: { postCount: { match: /Reply here to continue|I paused|Heads-up|Working · /, n: 0 }, ctl: { cmd: 'session', match: /"pause"/, n: 0 } } },
  ],
  judge: 'At the limit the routine stops and says why; nobody is asked to reply, since nobody runs it.',
};
