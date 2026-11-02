// i445 A2: the idle pause was a chat sentence; i684: it posts only while a question waits, and a reply still picks the session up.
export default {
  title: 'A turn ends and nobody replies: the session pauses with no message, and A\'s reply picks it up again',
  people: { A: 'owner, allowed' },
  env: { FAKE_IDLE_S: '30', IDLE_SWEEP_MS: '1000' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { advance: 40, pause: 3, expect: { noText: /Paused/ } },
    { A: 'also add a test for it', expect: { text: /^Picking up where we left off for A · / } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end', expect: { reaction: { on: 'last:A', name: 'white_check_mark', not: 'eyes' } } },
  ],
  judge: 'Nothing posts for a pause that waits on nobody; the reply after it is taken.',
};
