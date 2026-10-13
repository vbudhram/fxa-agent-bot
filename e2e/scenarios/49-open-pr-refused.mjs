// The controller refuses Open PR at once (the session is busy). The row gets its buttons back,
// the reply says to tap again (not !restart), and the next tap opens the PR.
export default {
  title: 'Open PR refused as busy: the buttons come back, no !restart advice, and a second tap opens the PR',
  env: { FAKE_FINISH_REFUSE: '1' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: { tap: 'Open PR' }, wait: { text: /tap Open PR again/ }, expect: { ctl: { cmd: 'finish', n: 1 }, noText: /!restart|Already wrapping up/ } },
    { A: { tap: 'Open PR' }, expect: { ctl: { cmd: 'finish', n: 2 }, noText: /Already wrapping up/ } },
    { advance: 'finish', wait: { text: /pull\/999999/ } },
  ],
  judge: 'The refusal says what happened and how to retry; the second tap works.',
};
