// A stack in one message: the team and the repos come with the task, with no picker and no second tag.
export default {
  title: 'One message starts a stack: !stack <team> repos=<name> <task> runs the task on those repos',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot !stack pyfxa-team repos=docs do it', expect: { ephemeral: { to: 'A', match: /`docs` is not one of/ }, noCtl: 'task' } },
    { A: '@bot !stack pyfxa-team repos=PyFxA make the live tests read the URL from env',
      expect: { ctl: { cmd: 'task', match: /--repos","mozilla\/PyFxA".*make the live tests/s, n: 1 }, noText: /Pick a team/ } },
    // The team is the session's: its card names it (ctl's log leaves out the global --pipeline).
    { advance: 'setup', wait: { text: /PyFxA team session/ } }, { advance: 'turn', wait: 'turn_end' },
  ],
  judge: 'A wrong repo name says which repos the team has; the right one starts the session at once on that repo.',
};
