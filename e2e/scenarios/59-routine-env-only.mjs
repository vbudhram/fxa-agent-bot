export default {
  title: 'Routines: a bot with no ROUTINES_ENV never ticks; the dev bot starts only the dev routine',
  people: { A: 'allowed' },
  matrix: { ROUTINES_ENV: ['', 'dev'] },
  env: { FAKE_ROUTINES: 'e2e/routines/env.json', ROUTINES_TICK_MS: '200' },
  steps: [
    { pause: 2, only: { ROUTINES_ENV: [''] }, expect: { ctl: { cmd: 'routine', n: 0 }, calls: { method: 'chat.postMessage', n: 0 } } },
    { root: /^UX review \(routine for FxA\) started/, only: { ROUTINES_ENV: ['dev'] },
      expect: { ctl: { cmd: 'routine', match: /"tick","--env","dev"/ }, postCount: { match: /^Code review \(routine/, n: 0 } } },
  ],
  judge: 'Only the bot whose env matches the routine starts it; a bot with no env runs no routine at all.',
};
