export default {
  title: 'Investigation: a run whose comment ctl posted on the ticket gives one thread line with the link, and no report in Slack',
  people: { A: 'allowed' },
  tape: 'tapes/routine-report.json',
  env: { FAKE_ROUTINES: 'e2e/routines/investigate.json', ROUTINES_ENV: 'live', ROUTINES_TICK_MS: '200' },
  steps: [
    { root: /^Investigation of <https:\/\/example\.atlassian\.net\/browse\/FXA-123\|FXA-123> started\.$/ },
    { advance: 'setup' },
    { advance: 'turn', wait: { text: /^Investigation posted on / }, expect: {
      text: /^Investigation posted on <https:\/\/example\.atlassian\.net\/browse\/FXA-123\|FXA-123>$/,
      edited: { match: /^Investigation of <https:\/\/example\.atlassian\.net\/browse\/FXA-123\|FXA-123>: posted\.$/ },
      ctl: { cmd: 'routine', match: /"done","140","--state","report","--session","agent-[a-z0-9]+","--report-file"/, n: 1 } } },
    { expect: { ctl: { cmd: 'finish', n: 0 }, postCount: { match: /Finding 1|the report is in this thread/, n: 0 } } },
  ],
  judge: 'The thread shows only the link to the Jira comment; none of the agent\'s report text reaches Slack.',
};
