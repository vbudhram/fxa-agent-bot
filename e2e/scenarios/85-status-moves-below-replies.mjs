// i445 L3: replies during a long turn pushed the live status out of view; it now moves below them.
export default {
  title: 'People reply while A\'s turn runs: the status moves below their replies, once, and the answer lands there',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  env: { STATUS_MOVE_MS: '1000' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' },
    { B: 'nice, curious what it finds' },
    { pause: 2 }, // the move waits STATUS_MOVE_MS after the status opened
    { advance: 'turn', wait: 'turn_end', expect: { calls: { method: 'chat.delete', n: 1 }, postCount: { match: /Getting ready|for A|Worked for/, n: 1 }, text: /Worked for .*Fake turn 1/s } },
  ],
  judge: 'The live status and then the answer sit below B\'s reply, and the thread holds one status, not two.',
};
