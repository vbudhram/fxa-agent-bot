export default {
  title: 'Jira: a quick answer files the ticket the person asked for, and a later look changes it under the thread\'s Jira key',
  people: { A: 'owner, allowed' },
  env: {
    QUICK_ANSWERS: '1', FAKE_ANSWER: 'The draft is ready.',
    FAKE_ANSWER_JIRA: '{"type":"Bug","summary":"Sign-in times out on slow networks","labels":["auth"]}\n{"key":"FXA-4242","labels":["ui"]}',
  },
  steps: [
    { A: '@bot file a ticket for the sign-in timeout on slow networks', wait: { text: /Filed FXA-4242/ },
      expect: { ctl: { cmd: 'session', match: /"jira-draft","agent-[a-z0-9]+","--stdin"\]/, n: 1 } } },
    { A: 'add the label ui to that ticket', wait: { text: /Changed FXA-4242/ },
      expect: { ctl: { cmd: 'session', match: /"jira-draft","agent-[a-z0-9]+","--stdin","--as","agent-[a-z0-9]+"\]/, n: 1 } } },
  ],
  judge: 'The first quick answer files FXA-4242 for A with no session and no card. The follow-up look changes it at once and says so, with no new ticket.',
};
