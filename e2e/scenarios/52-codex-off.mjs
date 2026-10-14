export default {
  title: 'A asks for Codex where it is off: Claude runs, and A is told so',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot --codex fix the blur', expect: { ctl: { cmd: 'task', match: /fix the blur/ }, ephemeral: { to: 'A', match: /Codex is not available here yet, so Claude runs this/ }, ephemeralCount: { to: 'A', n: 1 } } },
    { advance: 'setup' },
    { advance: 'turn', wait: 'turn_end', expect: { text: /Fake turn 1/ } },
  ],
  judge: 'A gets Claude and one private line that says why, not a silent switch.',
};
