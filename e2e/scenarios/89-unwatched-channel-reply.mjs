export default {
  title: 'A tags the bot in a channel it does not watch: one short private reply per thread, and nothing starts',
  people: { A: 'owner, allowed' },
  env: { ALLOWED_CHANNELS: 'C_OTHER' },
  steps: [
    { A: '@bot fix the blur on the verify code input', expect: { ephemeral: { to: 'A', match: /^I don't work in this channel yet\. Ask an admin to add it\.$/ }, noCtl: 'task' } },
    { A: '@bot are you there?', expect: { ephemeralCount: { to: 'A', n: 1 }, noCtl: 'task', log: { match: /channel_not_watched C_TEST/, n: 2 } } },
  ],
  judge: 'The person learns why the bot is quiet, once, and no session starts in a channel it does not watch.',
};
