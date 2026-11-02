export default {
  title: 'Jira: "go ahead" under a draft card files that card once, with no new draft and no agent turn; an outsider\'s "yes" files nothing',
  people: { A: 'owner, allowed', C: 'outsider, not allowed' },
  env: { FAKE_TAPE: 'e2e/tapes/jira-draft.json' },
  steps: [
    { A: '@bot look into the sign-in timeout on slow networks', expect: { ctl: { cmd: 'task', match: /sign-in timeout/ } } },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /Jira draft/ } },
    { C: '@bot yes', expect: { noCtl: { cmd: 'session', match: /jira-file/ } } },
    { A: '@bot go ahead', wait: { text: /Filed FXA-4242/ }, expect: { ctl: { cmd: 'session', match: /"jira-file","agent-[a-z0-9]+","a{64}","UA"/, n: 1 } } },
    { advance: 1, expect: { ctl: { cmd: 'session', match: /jira-draft/, n: 1 }, noCtl: 'steer' } },
  ],
  judge: 'A\'s "go ahead" files the card as A, once; the agent gets no turn for it and no second draft appears. C\'s "yes" changes nothing.',
};
