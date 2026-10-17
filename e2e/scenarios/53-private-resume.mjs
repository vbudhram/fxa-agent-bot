export default {
  title: 'A team with a private repo, in a public channel: the bot does not start it, and says why',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot team:secret fix the blur', wait: { text: /run only in a private channel/ }, expect: { noCtl: 'task', noText: /Secret team session/, calls: { method: 'files.uploadV2', n: 0 } } },
  ],
  judge: 'A private team never runs in a public channel, so none of its code or replies can land there; the bot says where to start it.',
};
