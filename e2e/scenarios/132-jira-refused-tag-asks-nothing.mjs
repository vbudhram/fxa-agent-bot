export default {
  title: 'Jira: a refused tag that asks for a ticket does not make the owner\'s next draft file at once',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  env: { FAKE_TAPE: 'e2e/tapes/plain-then-jira-draft.json', STEER: 'owner' },
  steps: [
    { A: '@bot look into the sign-in timeout on slow networks', expect: { ctl: { cmd: 'task', match: /sign-in timeout/ } } },
    { advance: 'setup' },
    { advance: 'turn', wait: 'turn_end' },
    { A: '!stop', expect: { ctl: { cmd: 'stop' } } },
    { B: '@bot file a ticket for this', expect: { noCtl: 'task', ephemeral: { to: 'B', match: /Only they can continue/ } } },
    { A: '@bot check the retry logic too', expect: { ctl: { cmd: 'task', match: /resume-from/ } } },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /Jira draft/ }, expect: { noCtl: { cmd: 'session', match: /jira-file/ } } },
  ],
  judge: 'B is told the session is A\'s. A\'s resumed turn ends with a draft card that A can tap; no ticket is filed in B\'s name.',
};
