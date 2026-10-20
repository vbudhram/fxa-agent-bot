export default {
  title: 'A !stack checkout in a public channel of a private team\'s PR, whose old session left the bot\'s map, is refused',
  people: { A: 'owner, allowed' },
  env: { FAKE_FIND_PR_PROFILE: 'secret' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: { tap: 'Open PR' } }, { advance: 'finish', wait: { text: /pull\/999999/ } },
    { A: '!stop' },
    // !new puts a new session in the thread: the bot's map no longer holds the one that made the PR.
    { A: '!new start over', wait: { ctl: /"task"/ } },
    { A: '@bot !stack checkout https://github.com/mozilla/fxa/pull/999999', thread: 'T2', wait: { text: /run only in a private channel/ },
      expect: { noCtl: { cmd: 'task', thread: 'T2' } } },
  ],
  judge: 'A private team\'s work never moves into a public channel, also when the bot no longer holds the session that made the PR.',
};
