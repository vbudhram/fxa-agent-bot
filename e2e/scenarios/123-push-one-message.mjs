// "Pushing..." and then "Pushed" were two messages: the push's result now goes into its first message.
export default {
  title: 'A taps Push branch: one message that says it pushes, then what it pushed',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Push branch/ } },
    { A: { tap: 'Push branch' }, wait: { text: /Pushing the branch/ } },
    { advance: 'finish', wait: { text: /Pushed `agent-fake`/ }, expect: { postCount: { match: /Pushing the branch|Pushed `agent-fake`/, n: 1 } } },
  ],
  judge: 'One message for the push: it starts as "Pushing" and becomes "Pushed" with the compare link.',
};
