// "Where is the PR?" in a real thread got two prose replies and no PR: in words it is the Open PR
// tap, an edit of it starts nothing, and once the PR is up the same question gets its link.
export default {
  title: 'A asks where the PR is: the bot opens it, an edit adds no turn, and the next ask gets the link',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { A: 'where is the PR?', expect: { ctl: { cmd: 'finish', n: 1 }, noCtl: 'steer' } },
    { A: { edit: 'last', text: 'where is the PR??' }, expect: { noCtl: 'steer' } },
    { advance: 'finish', wait: { text: /pull\/999999/ } },
    { A: 'where is the PR?', expect: { text: /Here is the PR: .*pull\/999999/, noCtl: 'steer' } },
  ],
  judge: 'One ask opens the PR with no prose answer; the edit is silent; the second ask answers with the link only.',
};
