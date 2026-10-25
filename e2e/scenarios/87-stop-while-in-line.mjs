export default {
  title: 'A stops a request that waits in line: its "In line" message no longer promises a start',
  people: { A: 'owner, allowed' },
  env: { FAKE_TASK_CAP: '99', QUEUE_RETRY_MS: '2000' },
  steps: [
    { A: '@bot fix the blur on the verify code input', wait: { text: /^In line for A · 1st in line .*30 min.*!stop/ } },
    { A: '!stop', wait: { text: /Stopped/ }, expect: { edited: { match: /Stopped before it started/ }, noText: /I start as soon as one frees up|work so far is kept|Session ended|saving the work/ } },
  ],
  judge: 'The In line message says how long the request waits and how to cancel it. After the stop, nothing in the thread says the request will still start, or that work was saved.',
};
