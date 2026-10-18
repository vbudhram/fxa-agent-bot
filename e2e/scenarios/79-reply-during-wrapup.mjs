// A reply or a tag while Open PR wraps up is kept as context and gets the note. It must not keep a 👀 for good:
// the wrap-up never acts on it, so nothing would ever settle that reaction.
export default {
  title: 'A reply and a tag during the Open PR wrap-up get the kept-as-context note and no lasting 👀',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    // The reply comes right after the tap, before the bot's next poll: the wrap-up starts at the tap.
    { A: { tap: 'Open PR' }, wait: 'none' },
    { A: 'also check the label colour', expect: { ephemeral: { to: 'A', match: /I kept it as context/ }, noReaction: { name: 'eyes' }, noCtl: 'steer' } },
    { A: '@bot and the focus ring', expect: { noReaction: { name: 'eyes' }, noCtl: 'steer' } },
    { advance: 'finish', wait: { text: /pull\/999999/ }, expect: { ctl: { cmd: 'finish', n: 1 } } },
  ],
  judge: 'Each message during the wrap-up gets a clear note and no reaction that suggests the bot is working on it.',
};
