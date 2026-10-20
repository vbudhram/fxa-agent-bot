export default {
  title: 'Routines: when the report post fails, a later tag gets the routine-run hint, not the hint that the thread holds a report',
  people: { A: 'engineer, allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/report.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', E2E_CHANNELS: JSON.stringify({ C_TEST: { is_private: true } }), E2E_FAIL_POST: '^\\["Fake turn 1' },
  steps: [
    { root: /^Security review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /^Security review: / } },
    { A: '@bot what did it find', expect: { ephemeral: { to: 'A', match: /^This thread is for a routine run\. I do not take requests here\. To start work, tag me in a new thread\.$/ },
      ephemeralCount: { to: 'A', n: 1 }, noCtl: 'steer' } },
  ],
  judge: 'The hint never points at a report the thread does not hold.',
};
