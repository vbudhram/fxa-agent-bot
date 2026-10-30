export default {
  title: 'Jira: a clear request in the owner\'s own words files the agent\'s draft at once, as them, with Undo',
  people: { A: 'owner, allowed' },
  env: { FAKE_TAPE: 'e2e/tapes/jira-draft.json' },
  steps: [
    { A: '@bot file a ticket for the sign-in timeout on slow networks', expect: { ctl: { cmd: 'task', match: /sign-in timeout/ } } },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /Filed FXA-4242/ }, expect: { ctl: { cmd: 'session', match: /"jira-file","agent-[a-z0-9]+","a{64}","UA"/, n: 1 } } },
  ],
  judge: 'The ticket is filed once for A, and the thread shows it with Undo, Edit and Queue for ai-fixme.',
};
