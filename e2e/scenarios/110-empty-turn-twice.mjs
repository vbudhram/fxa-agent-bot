export default {
  title: 'Two empty turns in a row: one automatic follow-up, then a plain message that asks the person to reply',
  people: { A: 'owner, allowed' },
  env: { FAKE_TAPE: 'e2e/tapes/empty-twice.json' },
  steps: [
    { A: '@bot remove gettext from the content server', expect: { ctl: { cmd: 'task', match: /remove gettext/ } } },
    { advance: 'setup' },
    { advance: 'turn', expect: { ctl: { cmd: 'steer', match: /only its status line/, n: 1 } } },
    { advance: 'turn', wait: { text: /I stopped without writing a message\. Reply here and ask what I need\./ }, expect: { ctl: { cmd: 'steer', n: 1 }, noText: /Over to you/ } },
  ],
  judge: 'The agent is asked once; a second empty turn says plainly that it stopped without a message.',
};
