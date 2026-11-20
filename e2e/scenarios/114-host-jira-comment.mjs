export default {
  title: 'Host write: a team admin asks for a Jira comment in words, and the quick answer posts it with no card',
  env: { QUICK_ANSWERS: '1', FXA_CTL: 'e2e/tools/host-ctl.sh', PROFILE_ADMINS: 'fxa:UADMINX1', FAKE_ANSWER: 'The comment is ready.',
    FAKE_HOST_WRITE: '{"op":"jira-comment","key":"FXA-123","body":"The fix shipped in train 300."}' },
  people: { ADMINX1: 'team admin, allowed' },
  steps: [
    { ADMINX1: '@bot post a comment on FXA-123 that train 300 has the change', wait: { text: /Posted the comment on <https:\/\/jira\.example\.com\/browse\/FXA-123\|FXA-123>/ },
      expect: { ctl: { cmd: 'session', match: /"host-write","agent-[a-z0-9]+","--stdin","--by","UADMINX1","--words","[^"]*post a comment on FXA-123/, n: 1 } } },
  ],
  judge: 'The quick answer posts the comment at once for the admin and says so in one line with the link. No Apply card shows.',
};
