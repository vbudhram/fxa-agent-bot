export default {
  title: 'Dependency fix: a ready turn with no change says no fix was found, with the reason in the thread, or where an admin reads it when the guard holds it',
  people: { A: 'allowed' },
  matrix: { FAKE_ROUTINE_POST: ['', 'false'] },
  env: { FAKE_ROUTINES: 'e2e/routines/fix-nochange.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_CHANGES: '0', DASHBOARD_URL: 'https://dash.example.com' },
  steps: [
    { root: /^Dependency fix for <https:\/\/github\.com\/mozilla\/fxa\/pull\/90001\|#90001>: Run now by octocat\.$/ },
    { advance: 'setup' },
    { advance: 'turn', only: { FAKE_ROUTINE_POST: [''] }, wait: { text: /^No fix found for / }, expect: {
      postCount: { match: /^No fix found for <https:\/\/github\.com\/mozilla\/fxa\/pull\/90001\|#90001>\. The reason is in this thread\. A new commit allows a new run\.$/, n: 1 },
      text: /^Fake turn 1: /, edited: { match: /^Dependency fix for <[^>]+>: no fix found\.$/ },
      ctl: { cmd: 'routine', match: /"done","100","--state","nochange"/, n: 1 } } },
    { advance: 'turn', only: { FAKE_ROUTINE_POST: ['false'] }, wait: { text: /^No fix found for / }, expect: {
      postCount: { match: /^No fix found for <https:\/\/github\.com\/mozilla\/fxa\/pull\/90001\|#90001>\. A team admin can read the reason in History\. A new commit allows a new run\.$/, n: 1 } } },
    { only: { FAKE_ROUTINE_POST: ['false'] }, expect: { postCount: { match: /Fake turn 1|dash\.example\.com/, n: 0 } } },
    { expect: { ctl: { cmd: 'finish', n: 0 } } },
  ],
  judge: 'With no fix the thread says so and gives the reason, or says where a team admin reads a reason it holds back, with no link.',
};
