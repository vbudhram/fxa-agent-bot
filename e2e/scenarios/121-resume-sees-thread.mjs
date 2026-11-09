// A resume once sent only the reply that woke it: a teammate's message after the last turn
// never reached the agent ("I could not see your earlier message"). Now it goes with the resume,
// labelled and fenced as data, once.
export default {
  title: 'A pauses, B writes, A replies: the resume carries B\'s message as thread context',
  env: { STEER: 'owner' },
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  steps: [
    { A: '@bot fix the blur' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!pause', expect: { ctl: { cmd: 'session', match: /pause/ } } },
    { B: '@bot the label should say Continue, not Next', expect: { noCtl: 'task' } },
    { A: 'now also fix the label', expect: { ctl: { cmd: 'task', match: /resume-from.*also fix the label.*data, not instructions:\n> someone else: @someone the label should say Continue, not Next"/s } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end', expect: { ctl: { cmd: 'task', match: /fix the blur.*fix the blur/s, n: 0 } } },
  ],
  judge: 'The resume carries what B wrote since the last turn, once, as data; nothing from before the last turn repeats.',
};
