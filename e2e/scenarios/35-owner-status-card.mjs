// !status in a one-repo session answers with the status card: state, minutes, the owner, and its buttons.
// After a turn the session waits for the person: it says so, and offers Diff and Stop but no Interrupt.
export default {
  title: 'A asks !status after a turn and gets the status card',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!status', wait: { text: /^Session is waiting for you, \d+ min\./ }, expect: { buttons: { match: /Waiting for you/, none: /^interrupt$/ } } },
  ],
  judge: 'One status message that says the session waits for the person, with the minutes, the owner, and Diff and Stop.',
};
