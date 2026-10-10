export default {
  title: 'A sends !stop, then replies without a tag, under each STEER mode (catalog 24)',
  matrix: { STEER: ['mention', 'owner', 'anyone'] },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { A: '!stop', expect: { ctl: { cmd: 'stop' }, noReaction: { on: 'root', name: 'eyes' } } },
    { A: 'actually keep going', expect: { ctl: { cmd: 'task', match: /resume-from/ } }, only: { STEER: ['owner', 'anyone'] } },
    { A: 'actually keep going', expect: { noCtl: 'task', ephemeral: { to: 'A', match: /tag me/ } }, only: { STEER: ['mention'] } },
    { advance: 'setup', only: { STEER: ['owner', 'anyone'] } },
    { advance: 'turn', wait: 'turn_end', only: { STEER: ['owner', 'anyone'] } },
  ],
  judge: 'After a stop, A knows whether the reply restarted the work or needs a tag.',
};
