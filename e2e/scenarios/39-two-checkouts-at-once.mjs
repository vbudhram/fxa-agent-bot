// Decision: the first !stack checkout in a thread wins. A second one while the first starts
// changes nothing and tells the second person, privately, who took it.
const PR = 'https://github.com/mozilla/fxa/pull/4321';
export default {
  title: 'A and B send !stack checkout in one thread at the same moment: one checkout, B is told',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: `@bot !stack checkout ${PR}`, wait: 'none' },
    { B: `@bot !stack checkout ${PR}`,
      expect: { ctl: { cmd: 'task', match: /--checkout/, n: 1 }, ephemeral: { to: 'B', match: /<@UA> already took this thread's checkout/ } } },
  ],
  judge: 'One session starts, for A. B gets one private line that A took the checkout.',
};
