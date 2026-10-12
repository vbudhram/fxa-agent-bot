// Discovery finding: the status card offered Stop on a paused session, and a tap on it did nothing.
export default {
  title: 'A taps Stop on an old status card after a pause, then asks !status again',
  people: { A: 'owner, allowed' },
  steps: [
    { A: '@bot fix the blur on the verify code input' },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { A: '!status', wait: { buttons: /^Stop$/ } },
    { A: '!pause', expect: { ctl: { cmd: 'session', match: /pause/ } } },
    { A: { tap: 'Stop' }, expect: { ephemeral: { to: 'A', match: /paused.*nothing to stop/ }, noCtl: 'stop' } },
    { A: '!status', wait: { text: /^Session is paused/ },
      expect: { postCount: { match: /^Session is paused/, n: 1 } } },
  ],
  judge: 'A stale Stop tap gets a private line that the session is paused. The new status card has Diff and no Stop or Interrupt.',
};
