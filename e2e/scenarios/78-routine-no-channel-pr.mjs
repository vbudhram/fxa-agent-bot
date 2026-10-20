export default {
  title: 'Routines: a pr+notes run of a routine with no channel ships its draft PR, records it through routine done, and posts nothing in Slack',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/no-channel-pr.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200' },
  steps: [
    { wait: { ctl: /"task","--source","routine","--routine-run","45"/ } },
    { advance: 'setup' },
    { advance: 'turn', wait: { ctl: /^\["finish"|"finish"/ }, expect: { ctl: { cmd: 'finish', n: 1 }, noCtl: 'stop' } },
    // A run with no channel posts nothing, so the driver sees no Slack activity to wait on: wait for the stop itself.
    { advance: 'finish', wait: { ctl: /"argv":\["stop"/ }, expect: {
      ctl: { cmd: 'routine', match: /"done","45","--state","ok","--session","agent-[a-z0-9]+","--pr","https:\/\/github\.com\/mozilla\/fxa\/pull\/999999"/, n: 1 },
      ctlOrder: [/"finish"/, /"routine","done","45"/, /^\["stop"/] } },
    { expect: { calls: { method: 'chat.postMessage', n: 0 }, ctl: { cmd: 'finish', n: 1 } } },
    { expect: { calls: { method: 'chat.update', n: 0 } } },
  ],
  judge: 'A routine with no channel ships its PR and leaves Slack untouched.',
};
