export default {
  title: 'Routines: a scheduled pr+notes run ships once, waits for the PR, then ends with the PR link in its message and a broadcast reply',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/pr.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200' },
  steps: [
    { root: /^Code review \(routine for FxA\) started\. I review the commits on mozilla\/fxa from the last 24 hours\.$/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /Wrapping up/ }, expect: { ctl: { cmd: 'finish', n: 1 }, noCtl: 'stop' } },
    { advance: 'finish', wait: { text: /^Code review: draft PR/ }, expect: {
      edited: { match: /^Code review: done\. See the reply in this thread\.$/ },
      postCount: { match: /^Code review: draft PR <https:\/\/github\.com\/mozilla\/fxa\/pull\/999999\|#999999>\. The findings it did not fix are in the PR description\. Next run: <!date\^\d+\^/, n: 1 },
      calls: { method: 'chat.postMessage', match: /"reply_broadcast":true.*draft PR|draft PR.*"reply_broadcast":true/, n: 1 },
      ctl: { cmd: 'routine', match: /"done","41","--state","ok","--session","agent-[a-z0-9]+","--pr","https:\/\/github\.com\/mozilla\/fxa\/pull\/999999"/, n: 1 },
      ctlOrder: [/"finish"/, /"routine","done","41"/, /^\["stop"/] } },
    { expect: { ctl: { cmd: 'finish', n: 1 }, noButtonsLeft: /./, postCount: { match: /\$/, n: 0 } } },
  ],
  judge: 'The channel sees one message for the run that ends as a PR link with the next run time, and one unread reply with the same text; no buttons, no cost.',
};
