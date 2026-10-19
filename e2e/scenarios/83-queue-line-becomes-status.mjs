// i445 S1: the place in line was a separate text message; now it is the status line, and the session's status takes it over.
export default {
  title: 'A asks while every runner is busy: one status line says the place in line, then the same message shows the setup and the turn',
  people: { A: 'owner, allowed' },
  env: { FAKE_TASK_CAP: '1', QUEUE_RETRY_MS: '2000' },
  steps: [
    { A: '@bot fix the blur on the verify code input', wait: { text: /^In line for A · 1st in line/ } },
    { pause: 3, wait: { ctl: /"task".*"--owner","UA"/ }, expect: { edited: { match: /^Getting ready for A · / }, postCount: { match: /In line|Getting ready|Working for|Worked for/, n: 1 } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end', expect: { postCount: { match: /In line|Getting ready|Working for|Worked for/, n: 1 }, noText: /Waiting for capacity|freed up/ } },
  ],
  judge: 'One bot message carries the request from the line to the answer; nothing else says the bot is waiting.',
};
