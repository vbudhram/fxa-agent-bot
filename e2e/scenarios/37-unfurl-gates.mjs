// Code review finding: only the gate helper had a test; nothing checked that the link_shared
// handler uses it. A card shows only to an allowed user, and a watch card only in its own channel.
const W = 'https://desk.example/w/CWATCH:1791000000.000100';
export default {
  title: 'Link cards unfurl only for allowed people, and a watch card only in its own channel (review finding)',
  env: { WORK_OBJECTS: '1', DESKTOP_GATEWAY: 'https://desk.example', ALLOWED_CHANNELS: 'C_TEST,CWATCH' },
  people: { A: 'owner, allowed', C: 'outsider, not allowed' },
  steps: [
    { C: { shares: [W], channel: 'CWATCH' }, expect: { calls: { method: 'chat.unfurl', n: 0 } } },
    { A: { shares: [W] }, expect: { calls: { method: 'chat.unfurl', n: 0 } } }, // posted in C_TEST, the session runs in CWATCH
    { A: { shares: [W], channel: 'CWATCH' }, expect: { calls: { method: 'chat.unfurl', n: 1 } } },
    { C: { details: W, channel: 'CWATCH' }, expect: { calls: { method: 'entity.presentDetails', match: /Not available/, n: 1 } } },
    { A: { details: W }, expect: { calls: { method: 'entity.presentDetails', match: /Not available/, n: 2 } } },
    { A: { details: W, channel: 'CWATCH' }, expect: { calls: { method: 'entity.presentDetails', match: /entity_payload/, n: 1 } } },
  ],
  judge: 'Only a link from an allowed person, in its own channel, gets a card or a full view.',
};
