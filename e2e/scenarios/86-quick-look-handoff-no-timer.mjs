export default {
  title: 'A quick look that hands off before its status post lands leaves no timer that edits the deleted status',
  env: { QUICK_ANSWERS: '1', FAKE_ANSWER_S: '0', E2E_SLOW: 'chat.postMessage=400' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot why does the verify code input lose focus on blur?' },
    { advance: 'setup' }, { advance: 'setup' },
    { advance: 'turn', wait: 'turn_end', expect: { ctl: { cmd: 'task', n: 1 } } },
    { advance: 10, expect: { log: { match: /quick_status/, n: 0 } } },
  ],
  judge: 'The quick look hands off to a sandbox. Its status goes, and nothing keeps editing it after that.',
};
