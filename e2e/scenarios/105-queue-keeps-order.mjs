export default {
  title: 'A waits in line; B asks after a slot frees: B waits behind A, and A starts first',
  people: { A: 'owner, allowed', B: 'teammate, allowed' },
  env: { FAKE_TASK_CAP: '1', QUEUE_RETRY_MS: '5000' },
  steps: [
    { A: '@bot fix the blur on the verify code input', wait: { text: /^In line for A · 1st in line/ } },
    { B: '@bot fix the copy on the settings page', thread: 'T2', wait: { text: /^In line for B · 2nd in line/ }, expect: { noCtl: { cmd: 'task', match: /"--owner","UB"/ } } },
    { B: '!stop', thread: 'T2', wait: { text: /Stopped/ } },
    { wait: { ctl: /"task".*"--owner","UA"/ } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'The request that waited first starts first; a later request does not take the freed slot ahead of it.',
};
