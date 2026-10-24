export default {
  title: 'Dependency fix: a run that pushes edits its start line to the pushed SHA and broadcasts one reply with the next step',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/fix-pushed.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200' },
  steps: [
    { root: /^Dependency fix for <https:\/\/github\.com\/mozilla\/fxa\/pull\/90001\|#90001> \(@opentelemetry\/api\): BLEnder gave up\.$/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { ctl: /"finish"/ } },
    { advance: 'finish', wait: { text: /^Pushed 0123456 to / }, expect: {
      edited: { match: /^Dependency fix for <https:\/\/github\.com\/mozilla\/fxa\/pull\/90001\|#90001>: pushed 0123456\.$/ },
      postCount: { match: /^Pushed 0123456 to <https:\/\/github\.com\/mozilla\/fxa\/pull\/90001\|#90001>\. Next: review the fix commit, then approve the functional tests gate\.$/, n: 1 },
      calls: { method: 'chat.postMessage', match: /"reply_broadcast":true/, n: 1 },
      ctl: { cmd: 'routine', match: /"done","99","--state","ok"/, n: 1 } } },
    { expect: { postCount: { match: /draft PR|999999/, n: 0 } } },
  ],
  judge: 'The channel sees one start line that becomes the pushed SHA, and one broadcast reply that says what to do next; no draft PR wording.',
};
