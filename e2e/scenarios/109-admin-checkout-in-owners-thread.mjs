const PR = 'https://github.com/mozilla/fxa/pull/4321';
export default {
  title: 'In A\'s stopped thread, a teammate\'s !stack checkout is refused; a team admin\'s starts on the PR and A stays the owner',
  env: { PROFILE_ADMINS: 'fxa:UADMINX1' },
  people: { A: 'owner, allowed', B: 'teammate, allowed', ADMINX1: 'team admin, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' },
    { A: '!stop', expect: { ctl: { cmd: 'stop' } } },
    { B: `@bot !stack checkout ${PR}`, expect: { ephemeral: { to: 'B', match: /<@UA>'s session/ }, noCtl: { cmd: 'task', match: /--checkout/ } } },
    { ADMINX1: `@bot !stack checkout ${PR}`, expect: { ctl: { cmd: 'task', match: /"--owner","UA".*"--checkout"/, n: 1 } } },
  ],
  judge: 'B is told the thread is A\'s. The admin\'s checkout starts a session on the PR, and A still owns it.',
};
