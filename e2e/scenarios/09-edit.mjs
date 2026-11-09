export default {
  title: 'A edits a recent steer while a turn runs (catalog 13)',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { A: 'use helper X' },
    // A turn took the first version: the edit starts no turn of its own; the next turn gets it.
    { A: { edit: 'last', text: 'use helper Y' }, expect: { noCtl: { cmd: 'steer', match: /helper Y/ } } },
    { advance: 'turn', wait: 'turn_end' },
    { A: 'go on', expect: { ctl: { cmd: 'steer', match: /edited an earlier message.*helper Y.*go on/s } } },
    { advance: 'turn' }, { advance: 'turn', wait: 'turn_end', expect: { ctl: { match: /helper Y/, n: 1 } } },
  ],
  judge: 'The edit reaches the agent once, as an edit, with the next message.',
};
