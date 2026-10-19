// i445 A2: the idle pause was a chat sentence; now it is one small grey line, and a reply still picks the session up.
export default {
  title: 'A turn ends and nobody replies: the session pauses with one grey line, and A\'s reply picks it up again',
  people: { A: 'owner, allowed' },
  env: { FAKE_IDLE_S: '30', IDLE_SWEEP_MS: '1000' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { advance: 40, wait: { text: /Paused: nobody replied for a while/ }, expect: { postCount: { match: /Paused: nobody replied/, n: 1 }, noText: /pause since it's been quiet/ } },
    { A: 'also add a test for it', expect: { text: /^Picking up where we left off for A · / } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end', expect: { reaction: { on: 'last:A', name: 'white_check_mark', not: 'eyes' } } },
  ],
  judge: 'The pause is one quiet line that says what happened and what to do; the reply after it is taken.',
};
