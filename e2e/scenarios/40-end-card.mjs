// Decision (i37): one end card when a session stops: a person's stop, or its PR merging (which now
// stops a session waiting on its PR, too). No feedback buttons.
export default {
  title: 'A session ends with one end card: after !stop, or when its PR merges',
  // merge_mid_turn: the PR merges while a turn runs; the session ends after that turn (end_pending).
  matrix: { end: ['stop', 'merge', 'merge_mid_turn'] },
  // The PR merges 5 s (fake clock) after it opens: inside merge_mid_turn's 10 s turn, after the reply started it.
  env: { FAKE_CI_S: '0', FAKE_MERGE_S: '5' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: '@bot !stop', only: { end: ['stop'] }, wait: { text: /Session ended/ },
      expect: { postCount: { match: /Session ended.*Stopped\. The work so far is kept/, n: 1 } } },
    { A: { tap: 'Open PR' }, only: { end: ['merge', 'merge_mid_turn'] } },
    { advance: 'finish', only: { end: ['merge', 'merge_mid_turn'] }, wait: { text: /pull\/999999/ } },
    { A: 'also add a test for it', only: { end: ['merge_mid_turn'] }, wait: { ctl: /also add a test for it/ } },
    { advance: 5, pause: 3, only: { end: ['merge_mid_turn'] }, expect: { noCtl: 'stop', postCount: { match: /Session ended/, n: 0 } } },
    { advance: 'turn', only: { end: ['merge_mid_turn'] }, wait: { text: /Session ended/ },
      expect: { ctl: { cmd: 'stop', n: 1 }, postCount: { match: /Session ended.*The PR merged/, n: 1 } } },
    { advance: 5, pause: 3, only: { end: ['merge'] }, wait: { text: /Session ended/ },
      expect: { ctl: { cmd: 'stop', n: 1 }, postCount: { match: /Session ended.*The PR merged/, n: 1 } } },
    { advance: 1, expect: { postCount: { match: /Session ended/, n: 1 } } },
  ],
  judge: 'One end card, with the reason, the minutes and the PR when there is one, and no feedback buttons.',
};
