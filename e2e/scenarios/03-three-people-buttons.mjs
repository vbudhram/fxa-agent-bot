export default {
  title: 'A owner, B teammate, C not allowed: C tags, B and C tap Open PR, then A taps it twice (catalog 10, 25)',
  matrix: { NATIVE_STREAM: ['1', '0'] },
  env: { FAKE_CI_S: '0' },
  people: { A: 'owner, allowed', B: 'teammate, allowed', C: 'not allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { C: '@bot stop', expect: { ephemeral: { to: 'C', match: /not on the list/ }, noCtl: 'stop', ephemeralCount: { to: 'C', n: 1 } }, known: 'flag 2: C also gets a second ephemeral' },
    { B: { tap: 'Open PR' }, expect: { ephemeral: { to: 'B', match: /Only <@UA> can use these buttons/ }, noCtl: 'finish' } },
    { C: { tap: 'Open PR' }, expect: { noEphemeral: 'C', noCtl: 'finish' } },
    { A: { tap: 'Open PR' }, expect: { ctl: { cmd: 'finish', n: 1 } } },
    { A: { tap: 'Open PR', on: 'same' }, expect: { ctl: { cmd: 'finish', n: 1 } } },
    { advance: 'finish', wait: { text: /pull\/999999/ } },
  ],
  judge: 'Each refusal is private and names the owner. Only A starts a ship. One PR line, no duplicate status.',
};
