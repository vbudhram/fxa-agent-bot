// Open PR on a paused session resumes it only to ship: the resumed turn's "work carried over"
// reply is not news, so the thread gets the PR and nothing before it.
export default {
  title: 'Open PR on a paused session posts the PR, not a "work carried over" reply',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: '!pause' },
    { A: { tap: 'Open PR' } },
    { advance: 'setup' }, { advance: 'turn', wait: { text: /Wrapping up/ } },
    { advance: 'finish', wait: { text: /pull\/999999/ }, expect: { postCount: { match: /Fake turn/, n: 1 } } },
  ],
  judge: 'The resume that ships posts only the PR.',
};
