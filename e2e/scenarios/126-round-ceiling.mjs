// Small review rounds need no tap, but a PR gets at most 10 rounds on its own: a review bot that
// comments on each push would otherwise start rounds without end.
const rounds = [];
for (let i = 1; i <= 10; i++) {
  rounds.push({ advance: i === 1 ? 5 : 200, wait: { ctl: /Copilot reviewed the PR/ }, expect: { ctl: { match: /Copilot reviewed the PR/, n: i } } },
    { advance: 'turn', wait: 'turn_end' });
}
export default {
  title: 'The eleventh review round on a PR waits for a tap',
  env: { FAKE_CI_S: '0', FAKE_COPILOT_AT: Array.from({ length: 11 }, (_, i) => 5 + i * 200).join(' ') },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: { tap: 'Open PR' } },
    { advance: 'finish', wait: { text: /pull\/999999/ } },
    ...rounds,
    { advance: 200, wait: { text: /I already ran 10 review rounds/ }, expect: { ctl: { match: /Copilot reviewed the PR/, n: 10 } } },
  ],
  judge: 'Ten rounds run on their own; the eleventh asks for Fix it.',
};
