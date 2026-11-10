export default {
  title: 'Routines: a private-repo team\'s security review posts in any channel the bot is in, public too, with no privacy lookup',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/private.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200',
    E2E_CHANNELS: JSON.stringify({ C_PUB: { is_private: false } }) },
  steps: [
    { root: /^Security review \(routine for .*\) started/, expect: {
      calls: { method: 'conversations.info', n: 0 }, ctl: { cmd: 'routine', match: /"--state","failed"/, n: 0 } } },
  ],
  judge: 'The run starts in the public channel: the bot does not refuse it for the channel.',
};
