// A long reply ends behind Show more. One tap posts the rest once and takes the button away,
// so a second tap (or a client that still shows the button) cannot post it again.
export default {
  title: 'A taps Show more on a long reply: the rest posts once, and the button goes',
  tape: 'tapes/long-reply.json',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /^Show more$/ } },
    { A: { tap: 'Show more' }, expect: { postCount: { match: /REST-MARKER/, n: 1 }, buttons: { match: /check runs on submit/, none: /^more$/ } } },
    // A quick second tap, or a client that still shows the old button: nothing more posts.
    { A: { tap: 'Show more', on: 'same' }, expect: { postCount: { match: /REST-MARKER/, n: 1 } } },
  ],
  judge: 'The rest of the reply shows once, and no Show more button is left to post it again.',
};
