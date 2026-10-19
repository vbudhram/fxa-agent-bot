// CI 2026-10-19: a turn and the steer queued behind it ended in the same poll; the steer kept 👀 ⏳ and the replies swapped places.
export default {
  title: 'A steers while a turn runs, and both turns end before the next poll: each reply lands in order and both messages get ✅',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { A: 'use the shared helper instead', expect: { ctl: { cmd: 'steer', match: /shared helper/ } } },
    { advance: 20, wait: 'turn_end', expect: { reaction: { on: 'last:A', name: 'white_check_mark', not: 'eyes' } } },
  ],
  judge: 'Turn 1\'s reply comes before turn 2\'s, and neither of A\'s messages is left waiting.',
};
