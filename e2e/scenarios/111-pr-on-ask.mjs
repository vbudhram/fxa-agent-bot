export default {
  title: 'The owner asks for the PR in words: the agent writes ship: pr, and the bot opens the PR as !pr does',
  tape: 'tapes/ship-on-ask.json',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ }, expect: { noCtl: 'finish' } },
    { A: 'looks good, open a PR', expect: { ctl: { cmd: 'steer', match: /open a PR/ } } },
    { advance: 'turn', wait: { text: /host opens the PR now/ }, expect: { ctl: { cmd: 'finish', n: 1 } } },
  ],
  judge: 'A asks in plain words; after the agent says the change is verified, the bot opens the PR with no tap.',
};
