export default {
  title: 'Routines: a skip posts its reason once, counts as posted only after its post works, and posts to a public channel too',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/skips.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', E2E_FAIL_POST: '^\\["UX review skipped', E2E_CHANNELS: JSON.stringify({ C_PUB: { is_private: false } }) },
  steps: [
    { root: /^Code review skipped: no new commits since the last run\. Next run: <!date\^1792501200\^/, wait: { ctl: /"posted","54"/ }, expect: {
      postCount: { match: /skipped:/, n: 2 },
      ctl: { cmd: 'routine', match: /"posted"/, n: 2 } } },
    { pause: 1, expect: { ctl: { cmd: 'routine', match: /"posted","5[23]"/, n: 0 }, log: { match: /^E routine run 52: the skip post failed/, n: 1 } } },
  ],
  judge: 'A skip says why once; a skip that did not reach Slack is not counted as said; a private team\'s skip posts to the public channel it names.',
};
