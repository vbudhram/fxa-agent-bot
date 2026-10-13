// The rest's post fails (a Slack outage): the rest is not lost. Show more stays, and the next tap posts it.
export default {
  title: 'Show more when the post of the rest fails: the button stays, and a second tap posts it once',
  tape: 'tapes/long-reply.json',
  env: { E2E_FAIL_POST: 'REST-MARKER' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /^Show more$/ } },
    { A: { tap: 'Show more' }, expect: { postCount: { match: /REST-MARKER/, n: 0 } } },
    // The button stayed: this tap finds it.
    { A: { tap: 'Show more' }, expect: { postCount: { match: /REST-MARKER/, n: 1 }, buttons: { match: /check runs on submit/, none: /^more$/ } } },
  ],
  judge: 'The first tap posts nothing and leaves Show more; the second posts the rest once and the button goes.',
};
