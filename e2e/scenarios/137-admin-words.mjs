// The host reads consent only from a team admin's own message (lib/turn-words.sh): the bot passes those words
// with --admin-words-file, and never a teammate's.
export default {
  title: "Only a team admin's own message reaches the controller as --admin-words-file",
  env: { PROFILE_ADMINS: 'fxa:UADMINX1' },
  people: { ADMINX1: 'team admin, allowed', B: 'teammate, allowed' },
  steps: [
    { ADMINX1: '@bot fix the blur on the verify code input', expect: { ctl: { cmd: 'task', match: /"admin-words-file":"\{\\"user\\":\\"UADMINX1\\",\\"ts\\":\\"[0-9.]+\\",\\"text\\":\\"fix the blur/ } } },
    { advance: 'setup' }, { advance: 'turn', wait: { buttons: /Open PR/ } },
    { B: '@bot work on PR 2738', expect: { ctl: { cmd: 'steer', match: /work on PR 2738/ }, noCtl: { cmd: 'steer', match: /--admin-words-file/ } } },
    { advance: 'turn', wait: 'turn_end' },
    { ADMINX1: '@bot put the commit on PR 2738', expect: { ctl: { cmd: 'steer', match: /"admin-words-file":"\{\\"user\\":\\"UADMINX1\\",\\"ts\\":\\"[0-9.]+\\",\\"text\\":\\"<@UBOT> put the commit on PR 2738/ } } },
    { advance: 'turn', wait: 'turn_end' },
  ],
  judge: "The admin's start and reply carry their own words; the teammate's steer carries none.",
};
