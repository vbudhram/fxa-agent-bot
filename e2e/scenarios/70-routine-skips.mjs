export default {
  title: 'Routines: a skip posts its reason once, counts as posted only after its post works, and keeps to the private-channel rule',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/skips.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', E2E_FAIL_POST: '^\\["UX review skipped', E2E_CHANNELS: JSON.stringify({ C_PUB: { is_private: false } }) },
  steps: [
    { root: /^Code review skipped: no new commits since the last run\. Next run: <!date\^1792501200\^/, wait: { ctl: /"posted","51"/ }, expect: {
      postCount: { match: /skipped:/, n: 1 },
      ctl: { cmd: 'routine', match: /"posted"/, n: 1 },
      log: { match: /^E routine run 54: the skip is not posted: channel C_PUB is public/, n: 1 } } },
    { pause: 1, expect: { ctl: { cmd: 'routine', match: /"posted","5[234]"/, n: 0 }, log: { match: /^E routine run 52: the skip post failed/, n: 1 } } },
  ],
  judge: 'A skip says why once; a skip that did not reach Slack is not counted as said, and a private team\'s skip never lands in a public channel.',
};
