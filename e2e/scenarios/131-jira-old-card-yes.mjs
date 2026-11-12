export default {
  title: 'Jira: after a later turn asks something, "yes" answers that turn; the old draft card is not filed',
  people: { A: 'owner, allowed' },
  env: { FAKE_TAPE: 'e2e/tapes/jira-draft-then-ask.json' },
  steps: [
    { A: '@bot look into the sign-in timeout on slow networks', expect: { ctl: { cmd: 'task', match: /sign-in timeout/ } } },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /Jira draft/ } },
    { A: '@bot also check the retry logic', expect: { ctl: { cmd: 'steer', match: /retry logic/ } } },
    { advance: 'turn', wait: { text: /update the tests/ } },
    { A: '@bot yes', expect: { ctl: { cmd: 'steer', match: /yes/ }, noCtl: { cmd: 'session', match: /jira-file/ } } },
    { advance: 'turn', wait: { text: /updated the tests/ }, expect: { noCtl: { cmd: 'session', match: /jira-file/ } } },
  ],
  judge: 'A\'s "yes" after the question about tests goes to the agent as a steer. No ticket is filed, and the draft card stays tappable.',
};
