// A reply during Push branch is kept as context like an Open PR wrap-up, but a push opens no PR: the note
// must not tell the person to wait for one.
export default {
  title: 'A reply during Push branch gets a note about the push, not about a PR that never comes',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Push branch/ } },
    { A: { tap: 'Push branch' }, wait: 'none' },
    { A: 'also check the label colour', expect: { ephemeral: { to: 'A', match: /^(?![\s\S]*PR is open)[\s\S]*pushing the branch[\s\S]*I kept it as context/ }, noReaction: { name: 'eyes' }, noCtl: 'steer' } },
  ],
  judge: 'The note during the push says what the bot is doing and when the kept message is used, and never mentions a PR.',
};
