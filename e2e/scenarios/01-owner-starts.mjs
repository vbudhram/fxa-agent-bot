export default {
  title: 'A tags the bot, the session starts, and the turn ends with buttons',
  matrix: { NATIVE_STREAM: ['1', '0'] },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input', expect: { reaction: { on: 'self', name: 'eyes' }, ctl: { cmd: 'task', match: /fix the blur/ } } },
    { advance: 'setup' },
    { advance: 'turn', wait: 'turn_end', expect: { reaction: { on: 'last:A', name: 'white_check_mark', not: 'eyes' }, text: /Fake turn 1/ } },
  ],
  judge: 'One status line that turns into the answer, with Diff and Open PR. 👀 becomes ✅.',
};
