import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hostWriteOf, hostCard, hostDone, hostFail, HOST_MAX } from '../src/jira-draft.js';

const ids = (c) => c.blocks.filter((b) => b.type === 'actions').flatMap((b) => b.elements.map((e) => e.action_id));
const jc = { op: 'jira-comment', key: 'FXA-123', body: 'See <!channel> and ```x```' };
const pc = { op: 'pr-comment', url: 'https://github.com/mozilla/fxa/pull/42', body: 'Looks good.' };
const pb = { op: 'pr-body', url: 'https://github.com/mozilla/fxa/pull/42', body: 'x'.repeat(HOST_MAX + 10) };

test('only a write the controller takes counts: a known op, a body, and a well-formed target', () => {
  for (const w of [jc, pc, pb]) assert.equal(hostWriteOf(w), w);
  for (const w of [null, undefined, { ...jc, op: 'jira-delete' }, { ...jc, body: '  ' }, { ...jc, key: 'fxa-1' }, { ...pc, url: 'https://evil.example/pull/1' },
    { ...pc, url: 'https://github.com/a/b/pull/1|x>' }, { op: 'pr-body', key: 'FXA-1', body: 'x' }])
    assert.equal(hostWriteOf(w), null, JSON.stringify(w));
});

test('the card shows the op, the target and the exact body in a code block, with Apply and Discard', () => {
  const c = hostCard(jc, 'agent-a1', 'abcd', 'https://jira.example.com');
  assert.deepEqual(ids(c), ['host_apply', 'host_discard']);
  const text = JSON.stringify(c.blocks);
  assert.match(text, /Jira comment\* · <https:\/\/jira\.example\.com\/browse\/FXA-123\|FXA-123>/);
  assert.match(text, /&lt;!channel&gt;/, 'no mention can render');
  assert.match(text, /Only a team admin can apply this/);
  assert.ok(c.blocks.at(-1).elements.every((e) => e.value === 'agent-a1|abcd'));
  assert.match(JSON.stringify(hostCard(pc, 'k', 'i').blocks), /PR comment\* · <https:\/\/github\.com\/mozilla\/fxa\/pull\/42\|mozilla\/fxa#42>/);
});

test('a long body is cut on the card with a note', () => {
  const c = hostCard(pb, 'k', 'i'), text = JSON.stringify(c.blocks);
  assert.match(text, /PR description/);
  assert.ok(c.blocks[1].text.text.length < 3000);
  assert.match(text, new RegExp(`first ${HOST_MAX} of ${HOST_MAX + 10} characters\\. Apply writes all of it`));
  assert.doesNotMatch(JSON.stringify(hostCard(pc, 'k', 'i').blocks), /characters/);
  const lt = hostCard({ ...pb, body: '<!-- x -->\n'.repeat(400) }, 'k', 'i');
  assert.ok(lt.blocks[1].text.text.length <= 3000, 'the escape does not push the section past the Slack limit');
  assert.match(JSON.stringify(lt.blocks), /The card shows the first \d+ of 4400 characters/);
});

test('the result line links what the controller wrote', () => {
  assert.equal(hostDone(jc, { url: 'https://jira.example.com/browse/FXA-123?focusedCommentId=9' }), 'Posted the comment on <https://jira.example.com/browse/FXA-123?focusedCommentId=9|FXA-123>.');
  assert.equal(hostDone(pc, { url: 'https://github.com/mozilla/fxa/pull/42#issuecomment-1' }), 'Posted the comment on <https://github.com/mozilla/fxa/pull/42#issuecomment-1|mozilla/fxa#42>.');
  assert.equal(hostDone(pb, {}), 'Updated the PR description on mozilla/fxa#42.');
});

test('a failed write shows only the controller stderr, and a timeout says the write can be done', () => {
  assert.equal(hostFail({ stderr: 'warn\nERROR: That PR is not in the team repos.\n' }), 'I did not write it: That PR is not in the team repos.');
  const argv = { message: 'Command failed: /opt/ctl --backend gce session host-write k --stdin --by U --words x', stderr: '' };
  assert.equal(hostFail(argv), 'I did not write it: the write did not finish.');
  assert.match(hostFail({ ...argv, killed: true, signal: 'SIGTERM' }), /It is possible that it was done\. Look at the target/);
});

test('hostWrite runs the CLI with the JSON on stdin, and exit 3 is needsConfirm', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hw-')), stub = join(dir, 'ctl');
  writeFileSync(stub, `#!/bin/bash\nprintf '%s\\n' "$*" > "${dir}/args"; cat > "${dir}/in"\n[ -e "${dir}/three" ] && { echo needs-confirm >&2; exit 3; }\n[ -e "${dir}/one" ] && { echo 'That PR is not in the team repos.' >&2; exit 1; }\necho '{"ok":true,"url":"https://x.example/1","op":"pr-comment"}'\n`);
  chmodSync(stub, 0o755);
  process.env.FXA_CTL = stub;
  const ctl = await import('../src/ctl.js');
  assert.deepEqual(await ctl.hostWrite('agent-a1', pc, 'UA', { words: 'post that on the PR' }), { ok: true, url: 'https://x.example/1', op: 'pr-comment' });
  assert.equal(readFileSync(join(dir, 'args'), 'utf8').trim(), '--backend gce session host-write agent-a1 --stdin --by UA --words post that on the PR');
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'in'), 'utf8')), pc);
  await ctl.hostWrite('agent-a1', pc, 'UA', { confirmed: true, profile: 'fxa-private' });
  assert.equal(readFileSync(join(dir, 'args'), 'utf8').trim(), '--backend gce --pipeline fxa-private session host-write agent-a1 --stdin --by UA --confirmed');
  await ctl.hostWrite('agent-a1', pc, 'UA', { check: true });
  assert.match(readFileSync(join(dir, 'args'), 'utf8'), /--by UA --check$/m);
  writeFileSync(join(dir, 'three'), '');
  await assert.rejects(ctl.hostWrite('agent-a1', pc, 'UA', { words: 'x' }), (e) => e.needsConfirm === true);
  writeFileSync(join(dir, 'one'), ''); unlinkSync(join(dir, 'three'));
  await assert.rejects(ctl.hostWrite('agent-a1', pc, 'UA', { words: 'x' }), (e) => !e.needsConfirm && /not in the team repos/.test(e.stderr));
});
