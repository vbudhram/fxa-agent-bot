export default {
  title: 'A pauses, then replies without a tag, and the session resumes (catalog 19)',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!pause', expect: { ctl: { cmd: 'session', match: /pause/ } } },
    { A: 'now also fix the label', expect: { ctl: { cmd: 'task', match: /resume-from.*also fix the label/s } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'Pause says what is kept. The reply picks up where it left off, with no second start card.',
};
