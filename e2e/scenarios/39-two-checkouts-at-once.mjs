// Decision: the first !stack checkout in a thread wins. A second one changes nothing and tells
// its sender privately: who took the checkout, or, once that session exists, that the thread has
// a running session. Two messages at the same moment reach the bot in either order, so the
// scenario checks one checkout and one refusal, not which person wins.
const PR = 'https://github.com/mozilla/fxa/pull/4321';
const REFUSAL = /already took this thread's checkout|This thread has a running session/;
export default {
  title: 'A and B send !stack checkout in one thread at the same moment: one checkout, the other is told',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: `@bot !stack checkout ${PR}`, wait: 'none' },
    { B: `@bot !stack checkout ${PR}`,
      expect: { ctl: { cmd: 'task', match: /--checkout/, n: 1 }, calls: { method: 'chat.postEphemeral', match: REFUSAL, n: 1 } } },
  ],
  judge: 'One session starts, for whoever was first. The other person gets one private line about it.',
};
