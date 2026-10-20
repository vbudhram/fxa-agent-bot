export default {
  title: 'Routines: a tag in a live pr routine thread, or after it found nothing to fix, gets the routine-run hint, never a PR or report hint',
  people: { A: 'engineer, allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr-only.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_CHANGES: '0' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { A: '@bot is this done yet', expect: { ephemeral: { to: 'A', match: /^This thread is for a routine run\. I do not take requests here\. To start work, tag me in a new thread\.$/ },
      ephemeralCount: { to: 'A', n: 1 }, noCtl: 'steer' } },
    { advance: 'turn', wait: { text: /^Code review: no issue to fix\. Next run: / } },
    { A: '@bot fix the rest too', expect: { ephemeral: { to: 'A', match: /^This thread is for a routine run\. I do not take requests here\. To start work, tag me in a new thread\.$/ },
      ephemeralCount: { to: 'A', n: 2 }, noCtl: 'steer' } },
  ],
  judge: 'The hint matches what the thread holds: no PR and no report, so it says this thread takes no requests.',
};
