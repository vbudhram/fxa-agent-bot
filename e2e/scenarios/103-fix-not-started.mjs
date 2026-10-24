export default {
  title: 'Dependency fix: a skip for a new commit posts the not-started text with no start message, and a run whose boot ctl skips shows the same text, not the stderr line',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/fix-not-started.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', FAKE_ROUTINE_TASK_FAIL: 'boot: headRefOid 9f9f9f9 is not fix_head_sha' },
  steps: [
    { root: /^Dependency fix for <https:\/\/github\.com\/mozilla\/fxa\/pull\/90002\|#90002> not started: the PR has a new commit\. Add agent-help again to fix the new head\./, wait: { ctl: /"posted","103"/ }, expect: {
      postCount: { match: /#90002>( \(|:)/, n: 0 } } },
    { wait: { text: /90003\|#90003> not started/ }, expect: {
      postCount: { match: /^Dependency fix for <https:\/\/github\.com\/mozilla\/fxa\/pull\/90003\|#90003> not started: the PR has a new commit\. Add agent-help again to fix the new head\.$/, n: 1 },
      calls: { method: 'chat.update', match: /"text":"Dependency fix for <https:\/\/github\.com\/mozilla\/fxa\/pull\/90003\|#90003>: not started\."/, n: 1 },
      ctl: { cmd: 'routine', match: /"done","104","--state","failed","--reason"/, n: 1 } } },
    { expect: { postCount: { match: /headRefOid|fix_head_sha|failed/, n: 0 } } },
  ],
  judge: 'Each not-started fix says why and what to do next, in fixed words; no raw error reaches the channel.',
};
