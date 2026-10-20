export default {
  title: 'A request that waits in line until it gives up gets a reply that says so, and its "In line" message no longer promises a start',
  people: { A: 'owner, allowed' },
  env: { FAKE_TASK_CAP: '99', QUEUE_RETRY_MS: '4000', QUEUE_GIVE_UP_MS: '3000' },
  steps: [
    { A: '@bot fix the blur on the verify code input', wait: { text: /^In line for A · 1st in line/ } },
    { pause: 7, expect: { calls: { method: 'chat.postMessage', match: /I waited 30 minutes/, n: 1 }, edited: { match: /Not started: no session freed up/ } } },
  ],
  judge: 'The person who tagged the bot is told in a new reply that the request was dropped and how to retry.',
};
