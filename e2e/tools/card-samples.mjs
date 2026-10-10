// Made-up sample data for each card kind: fake PR, FXA-0000 style keys, example.com links.
// The env bases make the example links pass the card URL allowlist.
export const SAMPLE_ENV = { JIRA_URL: 'https://jira.example.com', SENTRY_URL: 'https://sentry.example.com', ARGO_URL: 'https://argo.example.com', GRAFANA_URL: 'https://grafana.example.com' };
const PR = 'https://github.com/mozilla/fxa/pull/999999';
const now = Date.parse('2026-10-10T12:00:00Z');

export const SAMPLES = {
  pr: { key: 'k1', number: 999999, title: 'Handle an expired session token in /account/status', url: PR, state: 'open', draft: true, repo: 'mozilla/fxa',
    additions: 52, deletions: 11, files: 2, ci: 'fail', checks: 42, failed: 1, failing: ['unit-auth-server'], changers: ['reviewer-a'], approvers: [], mergeable: 'MERGEABLE', jira: 'FXA-0000' },
  turn: { key: 'k1', summary: '**Done.** I fixed the expired token check in `/account/status`, and the unit tests pass.', files: 2, added: 52, removed: 11,
    tests: { passed: 44, failed: 0 }, lint: 0, types: 0, todos: { done: 4, total: 4 }, steps: 12, elapsed: '3m 4s', stages: ['Read the code', 'Edited 2 files', 'Ran the tests'], changes: 2 },
  tools: { profile: 'fxa', runtime: 'claude', read_only: false, repos: [{ slug: 'mozilla/fxa', write: true }], mcp: ['Jira', 'Sentry', 'GitHub', 'Argo CD', 'Grafana'] },
  jira: { key: 'FXA-0000', summary: 'Recovery phone copy is wrong on settings', status: 'In Progress', type: 'Bug', priority: 'P2', assignee: 'assignee-a' },
  sentry: { id: '1', shortId: 'FXA-AUTH-1A2', title: 'TypeError: cannot read token of null', culprit: 'verifySession', status: 'unresolved', project: 'fxa-auth-server',
    count: 412, userCount: 37, firstSeen: '2026-10-07T12:00:00Z', now, release: 'v1.290.0', permalink: 'https://sentry.example.com/issues/1/',
    hourly: [1, 2, 2, 3, 2, 2, 4, 4, 5, 7, 9, 11, 14, 17, 20, 24, 28, 32, 35, 35, 40, 40, 38, 37] },
  ci: { key: 'k1', number: 999999, failing: ['unit-auth-server', 'playwright-functional'], infra: ['playwright-functional'], running: 1, passed: 39,
    links: [{ name: 'unit-auth-server', url: 'https://github.com/mozilla/fxa/actions/runs/1' }, { name: 'playwright-functional', url: 'https://github.com/mozilla/fxa/actions/runs/2' }],
    needsTap: true, why: 'The PR has new commits from someone else, so the owner starts the round.' },
  review: { key: 'k1', number: 999999, who: 'Copilot', action: 'auto_round', comments: [
    { path: 'lib/session.ts', line: 42, body: 'Check for null before you read the token. Otherwise this throws.', outcome: 'fixed' },
    { path: 'lib/session.ts', line: 88, body: 'This log can include the email.', outcome: 'fixed' },
    { path: 'test/status.test.ts', line: 10, body: 'Add a test for an expired token.', outcome: 'answered' }] },
  tests: { passed: 44, failed: 1, lint: 0, types: 0, plan: [{ level: 'unit' }, { level: 'unit' }, { level: 'unit' }, { level: 'integration' }, { level: 'functional' }] },
  deploy: { apps: [
    { name: 'fxa-auth-stage', sync: 'Synced', health: 'Healthy', images: ['example/auth:v1.290.0'], finishedAt: '2026-10-10T14:02:00Z', url: 'https://argo.example.com/applications/fxa-auth-stage' },
    { name: 'fxa-auth-prod', sync: 'OutOfSync', health: 'Progressing', images: ['example/auth:v1.289.2'], unhealthy: 2, url: 'https://argo.example.com/applications/fxa-auth-prod' }] },
  grafana: { title: 'auth-server p95 latency', unit: 'ms', now: 120, url: 'https://grafana.example.com/d/abc', points: [90, 95, 100, 110, 180, 150, 130, 120, 115, 118, 122, 120] },
  status: { key: 'k1', state: 'working', minutes: 14, owner: 'U00000000', turns: 3, now: 'Running the unit tests', pr: { number: 999999, url: PR, state: 'draft', ci: 'running' } },
  sessions: { rows: [
    { key: 'k1', task: 'FXA-0000 recovery copy', state: 'working', minutes: 14, owner: 'U00000000', url: 'https://example.slack.com/archives/C0/p1' },
    { key: 'k2', task: 'Sentry 1A2', state: 'answered', minutes: 40, owner: 'U00000000', url: 'https://example.slack.com/archives/C0/p2' }] },
  end: { key: 'k1', reason: 'The PR merged.', minutes: 42, turns: 6, files: 2, added: 52, removed: 11, pr: { number: 999999, url: PR, state: 'merged' } },
  bot: { name: 'fxa-agent', version: 'v2026.10.10', uptime: '3d', services: [
    { name: 'Slack bot', state: 'up' }, { name: 'Controller', state: 'up', note: '3 live sessions' },
    { name: 'MCP: grafana', state: 'down', note: 'proxy not running' }, { name: 'Pipeline timers', state: 'up', note: 'next run 10:00' }] },
};
