// Live 2026-10-19: the stream showed the steps only to the thread starter, so the teammate who asked saw "Thinking...".
export default {
  title: 'A starts a plain thread and B asks the bot in it: the status is a normal message, everyone sees it, and it names B with no mention',
  people: { A: 'starter, allowed', B: 'teammate, allowed' },
  steps: [
    { A: 'the blur on the verify input looks off' },
    { B: '@bot can you fix this?', expect: { ctl: { cmd: 'task', match: /--owner","UA/ }, text: /^Getting ready for B · /, noText: /<@UB>/ } },
    { advance: 'setup', pause: 6, expect: { edited: { match: /for B( · |\n|$)/ } } }, // edits wait 3 s, and the turn polls every 5 s
    { advance: 'turn', wait: 'turn_end', expect: { text: /Worked for .*Fake turn 1/s } },
  ],
  judge: 'B asked, so the live status names B, and it is a plain message that A, B and everyone else can read while the turn runs.',
};
