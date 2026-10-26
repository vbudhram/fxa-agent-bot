export default {
  title: 'A request that waited in line before a bot restart keeps its give-up clock: past the limit, it is dropped at once with the reply',
  people: { A: 'owner, allowed' },
  env: { FAKE_TASK_CAP: '99', QUEUE_RETRY_MS: '4000', QUEUE_GIVE_UP_MS: '600000' },
  state: [{ key: 'agent-qr0001', channel: 'C_TEST', thread_ts: '1700000000.000100', owner: 'UA', state: 'queued', prompt: 'fix the blur', started_at: Date.now() - 900000, cursor: 0 }],
  steps: [
    { pause: 3, expect: { calls: { method: 'chat.postMessage', match: /I waited 30 minutes/, n: 1 } } },
  ],
  judge: 'A restart does not give a request that already waited past the limit another full wait.',
};
