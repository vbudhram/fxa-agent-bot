export default {
  title: 'Dependency fix: a tag in a fix-run thread, live or ended, gets the fix-run hint for that person only',
  people: { A: 'engineer, allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/fix-stopped.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_STOP_S: '8' },
  steps: [
    { root: /^Dependency fix for <https:\/\/github\.com\/mozilla\/fxa\/pull\/90001\|#90001>/ },
    { advance: 'setup' },
    { A: '@bot is it done', expect: { ephemeral: { to: 'A', match: /^This thread is for a dependency fix run\. To ask again, push a new commit and add agent-help on the PR, or tag me in a new thread with the PR link\.$/ }, noCtl: 'steer' } },
    { advance: 5, wait: { text: /^Stopped: / } },
    { A: '@bot try again', expect: { ephemeral: { to: 'A', match: /^This thread is for a dependency fix run\. To ask again, push a new commit and add agent-help on the PR, or tag me in a new thread with the PR link\.$/ },
      ephemeralCount: { to: 'A', n: 2 }, noCtl: 'steer' } },
  ],
  judge: 'The hint tells the person how to ask for a new fix; the thread takes no requests.',
};
