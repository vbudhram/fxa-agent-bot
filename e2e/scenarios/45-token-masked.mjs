// The agent prints its own tokens (a teammate asked it to run env): the thread never shows them.
export default {
  title: 'A reply that holds the runner\'s proxy and gateway tokens posts them masked',
  tape: 'tapes/token-reply.json',
  people: { A: 'owner, allowed' },
  env: { FAKE_DIFF_LINE: 'KEY=fxl_abcdefghijklmnopqrst' },
  steps: [
    { A: '@bot what is in your environment?' },
    { advance: 'setup' },
    { advance: 'turn', wait: 'turn_end', expect: { text: /fxl_<masked> and FXA_MCP_TOKEN=fxm_<masked>/, noText: /abcdefghij|0123456789abcdef/ } },
    // An upload sends its bytes outside chat.*: the Diff file is masked too.
    { A: { tap: 'Diff' }, expect: { calls: { method: 'files.uploadV2', match: /KEY=fxl_<masked>/, n: 1 } } },
  ],
  judge: 'No message or uploaded file in the thread shows a token; the reply says the values are masked.',
};
