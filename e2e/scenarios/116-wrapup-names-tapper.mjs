// Live 2026-11-02 (PR 21632): vbudhram tapped Update PR, and the wrap-up's status said "for Lauren Zugai", the owner.
export default {
  title: 'A owns the session and teammate B taps Open PR: the wrap-up status names B, and the line goes when the PR is up',
  env: { FAKE_CI_S: '0' },
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { B: { tap: 'Open PR' }, wait: { text: /^Wrapping up for B · / }, expect: { noText: /^Wrapping up for A/ } },
    { advance: 'finish', wait: { text: /pull\/999999/ }, expect: { ctl: { cmd: 'finish', n: 1 } } },
  ],
  judge: 'B started the wrap-up, so its status names B, not the owner A, and no "Wrapped up" line stays after the PR card.',
};
