import bolt from '@slack/bolt';
import * as ctl from './ctl.js';
import * as sessions from './sessions.js';
import { render, setupCard } from './render.js';

const { App } = bolt;
const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);
const CHANNELS = list(process.env.ALLOWED_CHANNELS);
const USERS = list(process.env.ALLOWED_USERS); // ponytail: static allowlist, Google group check later

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const pending = new Map(); // key → { prompt, owner, channel, thread_ts } until Start
const busy = new Set();    // sessions with a poll in flight

const allowed = (channel, user) => CHANNELS.includes(channel) && USERS.includes(user);

app.event('app_mention', async ({ event, say }) => {
  if (!allowed(event.channel, event.user)) return;
  if (event.thread_ts && sessions.get(event.channel, event.thread_ts)) return; // steer path handles it
  const prompt = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
  if (!prompt) return;
  const key = sessions.newKey();
  const thread_ts = event.thread_ts || event.ts;
  pending.set(key, { prompt, owner: event.user, channel: event.channel, thread_ts });
  await say({ thread_ts, text: 'I can take this on.', blocks: setupCard(key, prompt) });
});

app.action('start', async ({ ack, body, action, client }) => {
  await ack();
  const p = pending.get(action.value);
  if (!p || body.user.id !== p.owner) return;
  pending.delete(action.value);
  const s = sessions.put({ key: action.value, ...p, cursor: 0, state: 'starting' });
  await client.chat.postMessage({ channel: s.channel, thread_ts: s.thread_ts, text: 'On it! Give me a few minutes to get set up.' });
  ctl.task({ key: s.key, owner: s.owner, prompt: s.prompt }).catch((e) => fail(client, s, e));
});

app.action('cancel', async ({ ack, action }) => { await ack(); pending.delete(action.value); });

// Thread replies: the owner steers; everyone else is ignored in v0.
app.message(async ({ message, client }) => {
  if (!message.thread_ts || message.subtype || message.bot_id) return;
  const s = sessions.get(message.channel, message.thread_ts);
  if (!s || message.user !== s.owner || s.state === 'stopped') return;
  const text = message.text.replace(/<@[A-Z0-9]+>/g, '').trim();
  if (text) ctl.steer(s.key, text).catch((e) => fail(client, s, e));
});

const ownerAction = (id, fn) => app.action(id, async ({ ack, body, action, client }) => {
  await ack();
  const s = sessions.all().find((x) => x.key === action.value);
  if (!s || body.user.id !== s.owner) return;
  await fn(s, client, action).catch((e) => fail(client, s, e));
});

ownerAction('diff', async (s, client) => {
  const d = await ctl.diff(s.key);
  await client.files.uploadV2({ channel_id: s.channel, thread_ts: s.thread_ts, filename: `${s.key}.diff`, content: d || '(no changes)' });
});
ownerAction('open_pr', async (s, client) => {
  // Returns at once; the poll loop posts the PR link or the failure.
  await ctl.finish(s.key);
  await client.chat.postMessage({ channel: s.channel, thread_ts: s.thread_ts, text: 'Wrapping up: review, PR description, then a draft PR. I will post the link here.' });
});
ownerAction('stop', async (s, client) => {
  await ctl.stop(s.key);
  sessions.put({ ...s, state: 'stopped' });
  await client.chat.postMessage({ channel: s.channel, thread_ts: s.thread_ts, text: 'Stopped. The work so far is kept.' });
});
app.action(/^answer_\d+$/, async ({ ack, body, action }) => {
  await ack();
  const s = sessions.all().find((x) => x.key === action.value);
  if (s && body.user.id === s.owner) await ctl.steer(s.key, action.text.text);
});

async function fail(client, s, e) {
  console.error(s.key, e.stderr || e.message);
  await client.chat.postMessage({ channel: s.channel, thread_ts: s.thread_ts, text: "I hit an error and stopped. Details are in the bot log." });
}

// ponytail: one 5 s poll loop for every live session; a long-lived tail per session when there are many.
setInterval(async () => {
  for (const s of sessions.all()) {
    if (['stopped', 'failed', 'pr_open'].includes(s.state) || busy.has(s.key)) continue;
    busy.add(s.key);
    try {
      const { cursor, state, events } = await ctl.events(s.key, s.cursor);
      for (const ev of events) {
        const msg = render(s.key, ev);
        if (msg) await app.client.chat.postMessage({ channel: s.channel, thread_ts: s.thread_ts, ...msg });
      }
      sessions.put({ ...s, cursor, state });
    } catch (e) {
      console.error('events', s.key, e.stderr || e.message);
    } finally {
      busy.delete(s.key);
    }
  }
}, 5_000);

await app.start();
console.log('agent-tag is running (Socket Mode)');
