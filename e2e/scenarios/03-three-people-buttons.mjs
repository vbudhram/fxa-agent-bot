export default {
  title: 'A owner, B teammate, C not allowed: C tags, C taps Open PR, then B taps it twice (catalog 10, 25)',
  env: { FAKE_CI_S: '0' },
  people: { A: 'owner, allowed', B: 'teammate, allowed', C: 'not allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { C: '@bot stop', expect: { ephemeral: { to: 'C', match: /not on the list.*<@UA> runs this session/s }, noCtl: 'stop', ephemeralCount: { to: 'C', n: 1 } } },
    { C: { tap: 'Open PR' }, expect: { noEphemeral: 'C', noCtl: 'finish' } },
    { B: { tap: 'Open PR' }, expect: { ctl: { cmd: 'finish', n: 1 } } },
    { B: { tap: 'Open PR', on: 'same' }, expect: { ctl: { cmd: 'finish', n: 1 } } },
    { advance: 'finish', wait: { text: /pull\/999999/ } },
  ],
  judge: 'Each refusal is private and names the owner. C cannot ship; teammate B can. One PR line, no duplicate status.',
};
