import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLinks, watchPayload, jiraPayload, entity, TASK } from '../src/unfurl.js';

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
