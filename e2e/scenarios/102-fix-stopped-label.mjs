export default {
  title: 'Dependency fix: a live run that ctl stops because the agent-help label was removed says so, and never says a team admin stopped it',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/fix-stopped.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_STOP_S: '8' },
  steps: [
    { root: /^Dependency fix for <https:\/\/github\.com\/mozilla\/fxa\/pull\/90001\|#90001> \(nx\): label by octocat\.$/ },
    { advance: 'setup' },
    { advance: 5, wait: { text: /^Stopped: the agent-help label was removed\./ }, expect: {
      postCount: { match: /^Stopped: the agent-help label was removed\. Nothing was pushed\.$/, n: 1 },
      edited: { match: /^Dependency fix for <https:\/\/github\.com\/mozilla\/fxa\/pull\/90001\|#90001>: stopped\.$/ },
      ctl: { cmd: 'routine', match: /"done","102","--state","stopped"/, n: 1 },
      calls: { method: 'chat.postMessage', match: /"reply_broadcast":true/, n: 1 } } },
    { expect: { postCount: { match: /stopped by a team admin|draft PR/i, n: 0 }, ctl: { cmd: 'finish', n: 0 } } },
  ],
  judge: 'The thread says why the fix stopped and that nothing was pushed, in the words of the PR comment; it does not blame a team admin.',
};
