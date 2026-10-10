// node --import ./e2e/preload.mjs src/app.js: the real bot against a fake Slack.
// Patched before app.js builds its App: a WebClient binds its methods when it is made.
import bolt from '@slack/bolt';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createView } from './slack-view.mjs';
import { runScenario } from './driver.mjs';

const OUT = process.env.E2E_OUT;
const scenario = process.env.E2E_PERSONA
  ? (await import('./personas.mjs')).personaScenario(...process.env.E2E_PERSONA.split(':').map((x, i) => (i ? Number(x) : x)))
  : (await import(process.env.E2E_SCENARIO)).default;
const view = createView({ names: Object.fromEntries(Object.keys(scenario.people).map((p) => [`U${p}`, p])) });

bolt.webApi.WebClient.prototype.apiCall = async function (method, args = {}) { return view.apply(method, args); };

let app = null;
bolt.SocketModeReceiver.prototype.start = async function () {
  app = this.app;
  setImmediate(() => this.client.emit('connected'));
};

// The bot's log goes to the run folder; its "is running" line starts the scenario.
for (const level of ['log', 'error']) {
  const orig = console[level];
  console[level] = (...a) => {
    const line = a.map((x) => (typeof x === 'string' ? x : x instanceof Error ? x.stack : JSON.stringify(x))).join(' ');
    try { appendFileSync(join(OUT, 'bot.log'), `${level === 'error' ? 'E ' : ''}${line}\n`); } catch {}
    if (process.env.E2E_VERBOSE) orig(...a);
    if (line.startsWith('fxa-agent is running')) runScenario(app, view, scenario).then((ok) => process.exit(ok ? 0 : 1), (e) => { orig(e); process.exit(2); });
  };
}
