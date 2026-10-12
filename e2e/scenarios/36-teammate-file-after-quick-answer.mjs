// Code review finding: a teammate's untagged reply after a quick answer was wrapped before the
// follow-up, so a reply with only a file lost 'See the attached files.'.
export default {
  title: 'B replies with only a file, no tag, after A\'s quick answer (review finding)',
  env: { QUICK_ANSWERS: '1', STEER: 'anyone', FAKE_ANSWER: 'The verify code input checks the code on submit only.' },
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot why does the verify code input validate on blur?', wait: { text: /on submit only/ } },
    { B: { says: '', files: ['mobile.png'] }, wait: { text: /./ },
      expect: { ctl: { match: /someone else: See the attached files\./ } } },
    { advance: 'setup' },
    { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'B\'s file reaches the follow-up with the note that it is attached, marked as someone else.',
};
