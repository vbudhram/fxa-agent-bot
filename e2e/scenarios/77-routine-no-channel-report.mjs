export default {
  title: 'Routines: a report run of a routine with no channel runs, records its report through routine done, and posts nothing in Slack',
  people: { A: 'allowed' },
  tape: 'tapes/routine-report.json',
  env: { FAKE_ROUTINES: 'e2e/routines/no-channel-report.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200' },
  steps: [
    { wait: { ctl: /"task","--source","routine","--routine-run","44"/ }, expect: { ctl: { cmd: 'task', match: /"--thread"/, n: 0 } } },
    { advance: 'setup' },
    { advance: 'turn', wait: { ctl: /"argv":\["stop"/ }, expect: {
      ctl: { cmd: 'routine', match: /"done","44","--state","report","--session","agent-[a-z0-9]+","--report-file"/, n: 1 }, ctlOrder: [/"routine","done","44"/, /^\["stop"/] } },
    { expect: { ctl: { cmd: 'finish', n: 0 } } },
    { expect: { calls: { method: 'chat.postMessage', n: 0 }, ctl: { cmd: 'routine', match: /"done","44"/, n: 1 } } },
    { expect: { calls: { method: 'chat.update', n: 0 } } },
    { expect: { calls: { method: 'chat.startStream', n: 0 } } },
    { expect: { calls: { method: 'reactions.add', n: 0 } } },
    { expect: { calls: { method: 'conversations.info', n: 0 } } },
  ],
  judge: 'A routine with no channel leaves Slack untouched; its report goes to the controller only.',
};
