// !status in a one-repo session answers with the status card: state, minutes, the owner, and Diff, Interrupt and Stop.
export default {
  title: 'A asks !status after a turn and gets the status card',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!status', wait: { text: /^Session is working, \d+ min\./ } },
  ],
  judge: 'One status message with the state, the minutes, the owner, and the three buttons.',
};
