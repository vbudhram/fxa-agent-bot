export default {
  title: 'C, not allowed, starts a thread; B tags the bot in it and owns the session (real thread: a Firefox engineer asked)',
  people: { C: 'not allowed', B: 'teammate, allowed', D: 'teammate, allowed' },
  steps: [
    { C: 'why does /oauth/subscriptions/active reject a session token?' },
    { B: '@bot can you dig into this?', expect: { ctl: { cmd: 'task', match: /"--owner","UB"/ } } },
    { advance: 'setup' }, { advance: 'turn', wait: 'turn_end' },
    { D: 'is this the same as last week?', expect: { ephemeral: { to: 'D', match: /<@UB>'s session/ } } },
    { C: 'thanks, any update?', expect: { noEphemeral: 'C', noCtl: 'steer' } },
    { B: { tap: 'Open PR' }, expect: { ctl: { cmd: 'finish' } } },
    { advance: 'finish', wait: { text: /pull\/999999/ } },
  ],
  judge: 'B, who asked, owns the session and its buttons. Tips name B. C, who is not allowed, gets no owner tips.',
};
