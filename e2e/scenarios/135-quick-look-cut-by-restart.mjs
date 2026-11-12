export default {
  title: 'A quick look that a bot restart cut off: its card says so, and the thread asks the person to tag again, once',
  people: { A: 'owner, allowed' },
  homeFiles: { 'sessions.json.quick.json': { 'agent-qq0001': { channel: 'C_TEST', thread_ts: '1700000000.000200', card_ts: '1700000000.000300', status_ts: '1700000000.000400' } } },
  steps: [
    { pause: 3, expect: {
      calls: { method: 'chat.postMessage', match: /I restarted before I could answer this\. Tag me again/, n: 1 },
    } },
    { pause: 0, expect: { calls: { method: 'chat.update', match: /Stopped: I restarted before I answered/, n: 2 } } },
  ],
  judge: 'The stuck card and status change to a stopped line, and one message tells the person to tag again.',
};
