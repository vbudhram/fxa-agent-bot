import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLinks, watchPayload, jiraPayload, sentryPayload, entity, TASK, INCIDENT } from '../src/unfurl.js';

const hosts = { gateway: 'https://gw.example.run.app', jira: 'https://example.atlassian.net' };

test('only watch links on the gateway and FXA browse links get cards', () => {
  const got = parseLinks([
    'https://gw.example.run.app/w/C0AB12CD3:1791135361.015169',
    'https://example.atlassian.net/browse/FXA-123',
    'https://example.atlassian.net/browse/SEC-1',
    'https://evil.example.com/w/C0AB12CD3:1791135361.015169',
    'https://gw.example.run.app/d/agent-abc123',
    'not a url',
  ], hosts);
  assert.deepEqual(got.map((l) => l.kind + ':' + (l.key ?? `${l.channel}:${l.ts}`)),
    ['watch:C0AB12CD3:1791135361.015169', 'jira:FXA-123']);
});

test('a watch card shows the session state, request, owner and latest step', () => {
  const p = watchPayload({}, { key: 'agent-abc123', state: 'pr_open', prompt: '\nMake the page faster\nmore', owner: 'U1', status_text: 'Opened the PR', started_at: 1791135361000 });
  assert.equal(p.attributes.title.text, 'Make the page faster');
  assert.equal(p.attributes.display_id, 'agent-abc123');
  assert.deepEqual(p.fields.status, { value: 'pr open', tag_color: 'green' });
  assert.equal(p.fields.assignee.user.user_id, 'U1');
  assert.equal(p.fields.description.value, 'Opened the PR');
  assert.equal(p.fields.date_created.value, 1791135361);
  assert.equal(watchPayload({}, undefined).fields.status.value, 'no session');
});

test('a Jira card and its entity', () => {
  const link = { kind: 'jira', url: 'https://example.atlassian.net/browse/FXA-1', key: 'FXA-1' };
  const e = entity(link, jiraPayload({ key: 'FXA-1', summary: 'Fix it', status: 'Done', category: 'done', assignee: 'Dev One', type: 'Bug', priority: 'P2' }));
  assert.equal(e.entity_type, TASK);
  assert.deepEqual(e.external_ref, { id: 'FXA-1', type: 'jira' });
  assert.equal(e.app_unfurl_url, link.url);
  assert.deepEqual(e.entity_payload.fields.status, { value: 'Done', tag_color: 'green' });
  assert.equal(e.entity_payload.attributes.display_type, 'Bug');
});

test('Sentry issue links on the org host get cards, by id or short id', () => {
  const got = parseLinks([
    'https://mozilla.sentry.io/issues/7771266201/?referrer=slack&environment=prod',
    'https://mozilla.sentry.io/issues/FXA-AUTH-3BM/',
    'https://evil.example.com/issues/7771266201/',
    'https://mozilla.sentry.io/issues/?project=6231056',
  ], { ...hosts, sentry: 'https://mozilla.sentry.io' });
  assert.deepEqual(got.map((l) => [l.kind, l.ref]), [['sentry', '7771266201'], ['sentry', 'FXA-AUTH-3BM']]);
});

test('a Sentry card is a compact incident: status and level tags, impact, the day, two buttons, the logo', () => {
  const card = { id: '7771266201', shortId: 'FXA-AUTH-39E', title: 'Error: redis timeout', culprit: 'POST /v1/session/destroy',
    status: 'unresolved', level: 'error', project: 'fxa-auth', count: 5980, userCount: 213, release: '1.347.0',
    firstSeen: '2026-06-03T19:17:07Z', lastSeen: '2026-10-07T17:24:08Z', permalink: 'https://mozilla.sentry.io/issues/7771266201/',
    hourly: [0, 0, 1, 2, 8, 0] };
  const p = sentryPayload(card, 'https://icons.example');
  assert.equal(p.attributes.title.text, 'Error: redis timeout');
  assert.equal(p.attributes.display_id, 'FXA-AUTH-39E');
  assert.deepEqual(p.attributes.product_icon, { url: 'https://icons.example/sentry.png', alt_text: 'Sentry' });
  assert.deepEqual(p.fields.status, { value: 'Unresolved', tag_color: 'red' });
  assert.equal(p.fields.service.value, 'fxa-auth');
  assert.equal(p.fields.date_updated.value, Date.parse('2026-10-07T17:24:08Z') / 1000);
  assert.equal(p.fields.date_created, undefined);
  assert.equal(p.fields.severity, undefined);
  const cf = Object.fromEntries(p.custom_fields.map((f) => [f.key, f]));
  assert.deepEqual([cf.level.value, cf.level.tag_color], ['error', 'red']);
  assert.equal(cf.impact.value, '5,980 events · 213 users');
  assert.equal(cf.day.value, '11 events · peak 8 an hour');
  assert.deepEqual(p.display_order, ['status', 'level', 'date_updated', 'service', 'description', 'impact', 'day']);
  assert.deepEqual(p.actions.primary_actions.map((a) => a.action_id), ['wo_investigate', 'wo_open']);
  assert.equal(sentryPayload({ ...card, hourly: [0, 0] }).custom_fields.find((f) => f.key === 'day').value, 'No events');
  assert.equal(sentryPayload({ ...card, status: 'resolved', level: 'warning' }).fields.status.tag_color, 'green');
});

test('a Jira card leaves out an empty priority and shows the Jira logo', () => {
  const p = jiraPayload({ key: 'FXA-1', summary: 's', status: 'QA Verified', category: 'done', priority: '(none)' }, 'https://icons.example');
  assert.equal(p.fields.priority, undefined);
  assert.deepEqual(p.attributes.product_icon, { url: 'https://icons.example/jira.png', alt_text: 'Jira' });
  assert.equal(jiraPayload({ key: 'FXA-1', priority: 'P2' }).fields.priority.value, 'P2');
});

test('a Sentry entity is an incident keyed by the issue id', () => {
  const link = { kind: 'sentry', url: 'https://mozilla.sentry.io/issues/FXA-AUTH-3BM/', ref: 'FXA-AUTH-3BM', id: '7771266201' };
  const e = entity(link, { attributes: {} });
  assert.equal(e.entity_type, INCIDENT);
  assert.deepEqual(e.external_ref, { id: '7771266201', type: 'sentry' });
});
