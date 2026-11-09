// i682, i684: a pause while the agent's question waits names the owner, once. A real thread showed
// the pause note right under the question that had just ended the turn: then it posts nothing.
export default {
  title: 'The agent asks a question and nobody answers: the session pauses with no note under the question',
  tape: 'tapes/question.json',
  people: { A: 'owner, allowed' },
  env: { FAKE_IDLE_S: '30', IDLE_SWEEP_MS: '1000' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /^1$/ } },
    { advance: 40, pause: 3, expect: { noText: /Paused: my question above still waits/, calls: { method: 'conversations.replies', match: /"oldest"/, n: 1 } } },
  ],
  judge: 'The question is the last bot message, so the pause adds no note under it.',
};
