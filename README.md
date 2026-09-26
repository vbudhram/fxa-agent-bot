# agent-tag

A Slack front door for `fxa-sandbox-ctl`. An engineer tags `@fxa-agent` in a thread, taps Start, and steers the agent by replying. The bot keeps no session state of its own. It calls the ctl CLI and posts what the CLI reports.

## Setup (personal workspace)

1. Create the app from `manifest.yml` at api.slack.com/apps.
2. Install it to the workspace. Copy the `xoxb-` bot token.
3. Create an app-level token with `connections:write`. Copy the `xapp-` token.
4. Copy `.env.example` to `.env` and fill it in.
5. Invite the bot to a channel, then put the channel ID in `ALLOWED_CHANNELS`.
6. Run `npm install`, then `npm start`.

Socket Mode connects outbound, so the bot needs no public URL.

## ctl contract

The bot calls every command with `--backend gce` first. It depends only on these commands. Every Slack text goes in a file, never in an argument.

| Command | Returns |
|---|---|
| `task --source slack --id <key> --owner <slack-user> --prompt-file <f>` | exit 0 when the runner is booting |
| `steer <key> --message-file <f>` | exit 0 when the turn runs or is queued |
| `events <key> --since <cursor>` | JSON `{cursor, state, events: [{type, text, status?, options?}]}` |
| `diff <key>` | the working diff as text |
| `finish --session <key>` | the draft PR URL on the last line, after a wrap-up turn (up to 45 min) |
| `stop <key>` | exit 0 when the runner is gone |

Event types: `question` (with `options`), `turn_end` (with `status`: `needs-input` or `ready`), `error`. `state` is one of `starting`, `active`, `wrapping`, `pr_open`, `stopped`, `failed`.

## Not in v0

- Collaborators and comments from people who are not the owner. The bot ignores those replies.
- Take over, Try it, Screenshots, Tests.
- The idle sweep and resume.
- The voice model. The messages come from templates.
- Google group checks. `ALLOWED_USERS` is a static list.
