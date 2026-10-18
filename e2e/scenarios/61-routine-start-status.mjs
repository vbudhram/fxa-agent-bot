export default {
  title: 'Routines: a run starts with its status line in the thread, and no message names the run\'s sentinel owner',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/start.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200' },
  steps: [
    { root: /^Code review \(routine for FxA\) started\. I review the commits on mozilla\/fxa main since <!date\^1792200000\^/,
      wait: { ctl: /"task","--source","routine","--routine-run","31"/ },
      expect: { ctl: { cmd: 'task', match: /^\[\["task","--source","routine","--routine-run","31","--id","agent-[a-z0-9]+","--thread","C_TEST:[0-9.]+","--link","[^"]+"\]/, n: 1 } } },
    { advance: 'setup', wait: { text: /Working/ }, expect: { postCount: { match: /<@routine:|is not on the/, n: 0 }, calls: { method: 'chat.startStream', n: 0 } } },
  ],
  judge: 'A routine run looks like any session in its thread: a live status, and no odd mention of a fake user.',
};
