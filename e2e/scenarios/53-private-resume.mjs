export default {
  title: 'A team with a private repo, in a public channel: no diff file, and still none after a pause, a resume and a !restart',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot team:secret fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!diff', wait: { text: /only in a private channel/ }, expect: { calls: { method: 'files.uploadV2', n: 0 } } },
    { A: '!pause', expect: { ctl: { cmd: 'session', match: /pause/ } } },
    { A: 'now also fix the label', expect: { ctl: { cmd: 'task', match: /resume-from/ } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!diff', wait: { text: /only in a private channel/ }, expect: { calls: { method: 'files.uploadV2', n: 0 } } },
    // !restart keeps the team: the new task goes to the secret team, not FxA (a resume names none; ctl reads it).
    { A: '!restart', expect: { ctl: { cmd: 'task', team: 'secret', n: 2 } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!diff', wait: { text: /only in a private channel/ }, expect: { calls: { method: 'files.uploadV2', n: 0 } } },
  ],
  judge: 'The bot never posts the private team\'s diff in this public channel, before or after the resume, and says why each time.',
};
