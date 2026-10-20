export default {
  title: 'A private team request that was in line in a public channel before a bot restart: its "In line" message stops promising a start, and a reply says why',
  people: { A: 'owner, allowed' },
  state: [{ key: 'agent-qp0002', channel: 'C_TEST', thread_ts: '1700000000.000200', owner: 'UA', profile: 'secret', private: true, state: 'queued', prompt: 'fix the blur', started_at: 1700000000000, cursor: 0, queue_ts: '1700000000.000300' }],
  steps: [
    { pause: 2, expect: { noCtl: 'task', calls: { method: 'chat.update', match: /"ts":"1700000000\.000300".*Not started/, n: 1 }, postCount: { match: /run only in a private channel/, n: 1 } } },
  ],
  judge: 'A refused request does not keep saying it waits in line.',
};
