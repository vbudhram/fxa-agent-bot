export default {
  title: 'A turn that ends with only its status line gets one automatic follow-up, and the thread shows the real questions, never "Over to you."',
  people: { A: 'owner, allowed' },
  env: { FAKE_TAPE: 'e2e/tapes/empty-turn.json' },
  steps: [
    { A: '@bot remove gettext from the content server', expect: { ctl: { cmd: 'task', match: /remove gettext/ } } },
    { advance: 'setup' },
    { advance: 'turn', expect: { ctl: { cmd: 'steer', match: /only its status line/, n: 1 } } },
    { advance: 'turn', wait: { text: /Two questions before I change anything/ }, expect: { noText: /Over to you|I stopped without writing a message/ } },
  ],
  judge: 'The empty turn posts nothing; the agent is asked once to write its questions, and the thread shows them.',
};
