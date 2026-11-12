export default {
  title: 'Jira: the draft card still files after the session stops and resumes under a new key',
  people: { A: 'owner, allowed' },
  env: { FAKE_TAPE: 'e2e/tapes/jira-draft.json' },
  steps: [
    { A: '@bot look into the sign-in timeout on slow networks', expect: { ctl: { cmd: 'task', match: /sign-in timeout/ } } },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /Jira draft/ } },
    { A: '!stop', expect: { ctl: { cmd: 'stop' } } },
    { A: '@bot check the retry logic too', expect: { ctl: { cmd: 'task', match: /resume-from/ } } },
    { advance: 'setup' },
    { advance: 'turn', wait: 'turn_end' },
    { A: { tap: 'Create in FXA' }, wait: { text: /Filed FXA-4242/ }, expect: { ctl: { cmd: 'session', match: /jira-file/, n: 1 } } },
  ],
  judge: 'The tap on the old card files the ticket once, for A, in the resumed thread.',
};
