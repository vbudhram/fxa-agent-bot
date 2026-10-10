export default {
  title: 'A tags to resume a paused session: one resume in both event orders (catalog 22)',
  matrix: { order: ['message_first', 'mention_first'] },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!pause' },
    { A: '@bot keep going', expect: { ctl: { cmd: 'task', match: /resume-from/, n: 1 } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end', expect: { ctl: { cmd: 'task', match: /resume-from/, n: 1 } } },
  ],
  judge: 'Exactly one resume, one status line, one 👀 that turns into ✅.',
};
