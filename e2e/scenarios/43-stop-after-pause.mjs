// Code review finding: a !stop on a paused session counted the pause in the end card's minutes.
export default {
  title: 'A pauses a session, then stops it: the end card has no minutes that count the pause',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!pause', expect: { ctl: { cmd: 'session', match: /pause/ } } },
    { A: '!stop', wait: { text: /Session ended/ },
      expect: { postCount: { match: /Session ended/, n: 1 } } },
    { advance: 1, expect: { postCount: { match: /Session ended\. \d+ min/, n: 0 } } },
  ],
  judge: 'One end card, with no minutes, because the session was paused when it stopped.',
};
