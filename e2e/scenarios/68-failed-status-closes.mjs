export default {
  title: 'A session that ctl reports failed mid-turn gets its live status closed as Failed',
  people: { A: 'owner, allowed' },
  env: { FAKE_FAIL_S: '8' },
  known: { reacted: 'a session ctl fails mid-turn keeps its 👀 (main 30df0f6 does the same)' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' },
    { advance: '4', pause: 7, expect: { calls: { method: 'chat.stopStream', n: 1 }, edited: { match: /^Failed · / } } },
  ],
  judge: 'When the sandbox fails, the live status says so instead of spinning on.',
};
