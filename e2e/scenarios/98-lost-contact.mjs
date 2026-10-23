export default {
  title: 'The sandbox stops answering mid-turn: the status warns that contact is lost, then the turn ends with one message that says how to go on',
  people: { A: 'owner, allowed' },
  // From 6 fake seconds after the start every poll fails; the bot warns after 1 s and gives up after 10 s (real time),
  // more than one poll apart, as 60 s and 10 min are.
  env: { FAKE_EVENTS_FAIL_AFTER: '6', LOST_MS: '1000', GIVE_UP_MS: '10000' },
  steps: [
    { A: '@bot fix the blur on the verify code input', expect: { ctl: { cmd: 'task', match: /fix the blur/ } } },
    { advance: 'setup' },
    { advance: 1, wait: { text: /^I lost contact with the sandbox 10 minutes ago|^I lost contact with the sandbox/ }, expect: {
      text: /`!restart` starts fresh from this thread/ } },
    { expect: { calls: { method: 'chat.update', match: /Lost contact with the sandbox, retrying/, n: 1 } } },
    { expect: { postCount: { match: /I lost contact with the sandbox/, n: 1 } } },
  ],
  judge: 'One warning while the bot retries, then one message that says the contact is lost and how to start again.',
};
