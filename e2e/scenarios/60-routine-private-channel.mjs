export default {
  title: 'Routines: a private-repo team or a security review never posts to a public, unknown or shared channel',
  people: { A: 'allowed' },
  env: { FAKE_ROUTINES: 'e2e/routines/private.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200',
    E2E_CHANNELS: JSON.stringify({ C_PUB: { is_private: false }, C_EXT: { is_private: true, is_ext_shared: true, is_shared: true } }) },
  steps: [
    { pause: 2, wait: { ctl: /"done","23"/ }, expect: {
      calls: { method: 'chat.postMessage', n: 0 }, ctl: { cmd: 'routine', match: /"done","2[123]","--state","failed","--reason","[^"]*posts only to a private channel that is not shared/, n: 3 } } },
    { expect: { ctl: { cmd: 'task', n: 0 }, log: { match: /^E routine run 2[123] of routine/, n: 3 } } },
  ],
  judge: 'Nothing about a private team or a security review lands in a channel that is public, unknown to the bot, or shared with another workspace.',
};
