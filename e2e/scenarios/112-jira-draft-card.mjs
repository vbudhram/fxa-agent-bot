export default {
  title: 'Jira: a draft nobody asked for in words waits on its card; a teammate\'s tap files it once',
  people: { A: 'owner, allowed', B: 'teammate, allowed', C: 'outsider, not allowed' },
  env: { FAKE_TAPE: 'e2e/tapes/jira-draft.json' },
  steps: [
    { A: '@bot look into the sign-in timeout on slow networks', expect: { ctl: { cmd: 'task', match: /sign-in timeout/ } } },
    { advance: 'setup' },
    // Someone who may not use the bot asks in words: it is not a request, so the draft still waits on its card.
    { C: '@bot file a ticket for this right away' },
    { advance: 'turn', wait: { text: /Jira draft/ }, expect: { noCtl: { cmd: 'session', match: /jira-file/ } } },
    { B: { tap: 'Create in FXA' }, wait: { text: /Filed FXA-4242/ }, expect: { ctl: { cmd: 'session', match: /"jira-file","agent-[a-z0-9]+","a{64}","UB"/, n: 1 } } },
    { B: { tap: 'Create in FXA', on: 'same' }, expect: { ctl: { cmd: 'session', match: /jira-file/, n: 1 } } },
  ],
  judge: 'The card shows the draft and files nothing until B taps it; a second tap files nothing more.',
};
