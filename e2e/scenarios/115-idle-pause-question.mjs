// i682, i684: a pause while the agent's question waits says so and names the owner, once.
export default {
  title: 'The agent asks a question and nobody answers: the pause line names A and repeats that the question waits',
  tape: 'tapes/question.json',
  people: { A: 'owner, allowed' },
  env: { FAKE_IDLE_S: '30', IDLE_SWEEP_MS: '1000' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /^1$/ } },
    { advance: 40, wait: { text: /Paused: my question above still waits/ }, expect: { postCount: { match: /Paused: my question above still waits for your answer, <@UA>/, n: 1 } } },
  ],
  judge: 'The pause line says the question still waits and names A; it posts once.',
};
