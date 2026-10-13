// In a stack, !pr <repo> takes only that repo's Open PR and Push off the button row. A Show more that
// was already used must not come back with the rest of the row.
export default {
  title: 'A stack reply behind Show more: tap it, then !pr fxa: Show more does not come back',
  tape: 'tapes/long-reply.json',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot !stack', wait: { text: /Pick a team/ } },
    { A: { pick: 'PyFxA team' }, wait: { buttons: /Use these/ } },
    { A: { tap: 'Use these' } },
    { A: '@bot make the live tests read the URL from env' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /^Show more$/ } },
    { A: { tap: 'Show more' }, expect: { postCount: { match: /REST-MARKER/, n: 1 } } },
    { A: '!pr fxa', expect: { ctl: { cmd: 'finish', match: /--repo","mozilla\/fxa"/, n: 1 }, buttons: { match: /check runs on submit/, none: /^more$/ } } },
  ],
  judge: 'The other buttons stay; Show more stays gone after its rest was posted.',
};
