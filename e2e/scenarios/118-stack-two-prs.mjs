// A plain tag that names a second repo starts a stack of both. With 2 PRs to ship, the turn has one
// Open 2 PRs, and a typed "open PRs" is that tap: both repos ship in one finish, with no agent turn.
export default {
  title: 'A plain tag naming the docs starts a two-repo stack; Open 2 PRs, or a typed "open PRs", ships both',
  // command: a plain !pr ships both too. menu: one repo's Open PR from the More menu ships only that repo.
  matrix: { ship: ['tap', 'typed', 'command', 'menu'] },
  env: { FAKE_PROFILES: new URL('../profiles-two-prs.json', import.meta.url).pathname, FAKE_PR_REPOS: 'mozilla/fxa,mozilla/ecosystem-platform' },
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot team:pyfxa-team fix the text in fxa-auth-server, then update the docs',
      expect: { ctl: { cmd: 'task', match: /--repos","mozilla\/fxa,mozilla\/ecosystem-platform"/, n: 1 } } },
    { advance: 'setup', wait: { text: /`mozilla\/ecosystem-platform` works here/ } },
    { advance: 'turn', wait: { buttons: /Open 2 PRs/ }, expect: { buttons: { match: /Fake turn/, none: /^(open_pr|push_branch)$/ } } },
    { A: { tap: 'Open 2 PRs' }, only: { ship: ['tap'] },
      expect: { ctl: { cmd: 'finish', match: /--repo","mozilla\/fxa","--repo","mozilla\/ecosystem-platform"/, n: 1 } } },
    { A: 'open PRs please', only: { ship: ['typed'] },
      expect: { ctl: { cmd: 'finish', match: /--repo","mozilla\/fxa","--repo","mozilla\/ecosystem-platform"/, n: 1 }, noCtl: 'steer' } },
    { A: '!pr', only: { ship: ['command'] },
      expect: { ctl: { cmd: 'finish', match: /--repo","mozilla\/fxa","--repo","mozilla\/ecosystem-platform"/, n: 1 } } },
    { A: { pick: 'Open PR · ecosystem-platform' }, only: { ship: ['menu'] },
      expect: { ctl: { cmd: 'finish', match: /"--repo","mozilla\/ecosystem-platform"\]/, n: 1 }, edited: { match: /Open PR · mozilla\/ecosystem-platform · started by/ } } },
    { advance: 'finish', only: { ship: ['tap', 'typed', 'command'] }, wait: { text: /mozilla\/fxa\/pull\/999999/ } },
    { advance: 'finish', wait: { text: /mozilla\/ecosystem-platform\/pull\/999999/ } },
  ],
  judge: 'The start card lists both repos. The turn shows one Open 2 PRs, not a row of buttons for each repo. The tap or the short typed reply opens both PRs, one after the other, and the agent gets no turn for it.',
};
