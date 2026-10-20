export default {
  title: 'Routines: in a routine thread a plain reply gets nothing and a tag gets a private hint; nothing steers the run',
  people: { A: 'engineer, allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/report.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200', E2E_CHANNELS: JSON.stringify({ C_TEST: { is_private: true } }), STEER: 'mention' },
  steps: [
    { root: /^Security review \(routine for FxA\) started/ },
    { advance: 'setup' },
    { A: 'this looks wrong, can you also check the login route?', expect: { noPublicPost: true, noEphemeral: 'A', noCtl: 'steer' } },
    { A: '@bot pause this routine', expect: { ephemeral: { to: 'A', match: /^This thread is for a routine run\. I do not take requests here\. To start work, tag me in a new thread\.$/ },
      ephemeralCount: { to: 'A', n: 1 }, noCtl: 'steer', noPublicPost: true } },
    { A: '!stop', expect: { noPublicPost: true, noCtl: 'stop' } },
    { A: { react: '-1', on: 'status' }, expect: { noCtl: 'interrupt', noEphemeral: 'A' } },
    { advance: 'turn', wait: { text: /^Security review: the report is in this thread/ }, expect: { ctl: { cmd: 'task', n: 1 } } },
    { A: '@bot fix the first finding', expect: { ephemeral: { to: 'A', match: /^This thread holds a routine's report\. To work on a finding, tag me in a new thread and paste the finding\.$/ },
      ephemeralCount: { to: 'A', n: 2 }, noCtl: 'steer' } },
  ],
  judge: 'People can talk about the result in the thread without the bot answering each reply; a tag gets one private pointer to the right way to start work.',
};
