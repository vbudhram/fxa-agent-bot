export default {
  title: 'Routines: a security review whose findings became tickets posts ctl\'s ticket keys, not the agent\'s findings',
  people: { A: 'allowed' },
  tape: 'tapes/routine-report.json',
  env: {
    FAKE_ROUTINES: 'e2e/routines/report.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', E2E_CHANNELS: JSON.stringify({ C_TEST: { is_private: true } }),
    FAKE_ROUTINE_REPORT: 'Security review: 1 finding(s) for tickets (2 listed).\nFiled FXA-51 (HIGH)',
  },
  steps: [
    { root: /^Security review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /^Security review: the report is in this thread\. No code changed\./ }, expect: {
      text: /^Security review: 1 finding\(s\) for tickets \(2 listed\)\.\nFiled FXA-51 \(HIGH\)$/ } },
    { expect: { postCount: { match: /the account route logs the session token/, n: 0 } } },
  ],
  judge: 'The thread shows only the ticket keys from ctl, and none of the agent\'s finding text.',
};
