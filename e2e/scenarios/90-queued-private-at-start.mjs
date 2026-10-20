export default {
  title: 'A private team session queued in a public channel before a bot restart does not start, and the thread says why',
  people: { A: 'owner, allowed' },
  state: [{ key: 'agent-qp0001', channel: 'C_TEST', thread_ts: '1700000000.000100', owner: 'UA', profile: 'secret', private: true, state: 'queued', prompt: 'fix the blur', started_at: 1700000000000, cursor: 0 }],
  steps: [
    { pause: 2, expect: { noCtl: 'task', text: /run only in a private channel/ } },
  ],
  judge: 'A private team never runs in a public channel, also for a request that waited in line across a restart.',
};
