export default {
  title: 'After a quick answer, A picks the PyFxA team, then asks without a tag (a live dev thread)',
  env: { QUICK_ANSWERS: '1', FAKE_ANSWER: 'Ready when you are. What would you like to test?' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot lets test some things', wait: { text: /Ready when you are/ } },
    { A: '!stack', wait: { text: /Pick a team/ } },
    { A: { pick: 'PyFxA team' }, wait: { buttons: /Use these/ } },
    { A: { tap: 'Use these' } },
    { A: 'what is in pyfxa?', expect: { ctl: { cmd: 'task', match: /--repos","mozilla\/PyFxA,mozilla\/fxa/ }, noCtl: 'answer' } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'The pick decides what the next message works on: the PyFxA team session starts, not a quick look at FxA only.',
};
