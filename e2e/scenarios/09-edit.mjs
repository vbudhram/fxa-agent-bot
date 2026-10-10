export default {
  title: 'A edits a recent steer while a turn runs (catalog 13)',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { A: 'use helper X' },
    { A: { edit: 'last', text: 'use helper Y' }, expect: { ctl: { cmd: 'steer', match: /edited an earlier message.*helper Y/s } } },
    { advance: 'turn' }, { advance: 'turn' }, { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'The edit reaches the agent once, as an edit.',
};
