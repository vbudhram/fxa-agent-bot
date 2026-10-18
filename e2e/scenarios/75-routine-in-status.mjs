export default {
  title: 'Routines: the channel status list names a routine run by the routine, not by its sentinel owner',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr-only.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200' },
  steps: [
    { root: /^Code review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { A: '@bot !status', thread: 'T2', expect: {
      ephemeral: { to: 'A', match: /^1 session:\n• Code review \(routine for FxA\) · \*[^*]+\*.* · <[^|>]+\|Code review>$/ } } },
  ],
  judge: 'The status list says which routine is running, with no broken mention.',
};
