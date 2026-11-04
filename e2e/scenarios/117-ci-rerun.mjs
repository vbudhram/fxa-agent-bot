// CI on the bot's PR fails outside the change: the bot reruns the failed jobs once and starts no round.
// The rerun fails again, so the second failure starts the usual CI round.
export default {
  title: 'CI fails outside the change: one rerun, then a CI round on the second failure',
  env: { FAKE_CI_S: '0', FAKE_CI_FAIL: 'unit: 503 Service Unavailable' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: { tap: 'Open PR' } },
    // The first looks after the PR opens: the rerun, then (the rerun's job has a new link) the round.
    { advance: 'finish', wait: { ctl: /CI failed on the PR/ },
      expect: { text: /reran the failed jobs once: `unit: 503 Service Unavailable`/, ctl: { match: /ci-rerun/, n: 2 } } },
    { advance: 'turn', wait: 'turn_end' },
    { pause: 3, expect: { ctl: { match: /CI failed on the PR/, n: 1 } } },
  ],
  judge: 'The first CI failure gets one rerun with its reason and no round; the second failure starts one CI round.',
};
