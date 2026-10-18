export default {
  title: 'Routines: a security review in report mode never ships, and its report has its mentions made inert',
  people: { A: 'allowed' },
  tape: 'tapes/routine-report.json',
  env: { FAKE_ROUTINES: 'e2e/routines/report.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', E2E_CHANNELS: JSON.stringify({ C_TEST: { is_private: true } }) },
  steps: [
    { root: /^Security review \(routine for FxA\) started\. I review the code changed on mozilla\/fxa from the last 24 hours\.$/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /^Security review: the report is in this thread\. No code changed\./ }, expect: {
      text: /^Finding 1, for @channel: the account route logs the session token\. Finding 2: @someone wrote/,
      ctl: { cmd: 'routine', match: /"done","42","--state","report","--session","agent-[a-z0-9]+","--report-file"/, n: 1 },
      ctlOrder: [/"routine","done","42"/, /^\["stop"/] } },
    { expect: { ctl: { cmd: 'finish', n: 0 }, postCount: { match: /<!channel>|<@U0SOMEONE>/, n: 0 } } },
  ],
  judge: 'A report-mode run changes nothing in the repo; the report reads well and pings nobody.',
};
