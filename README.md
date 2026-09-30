# fxa-agent

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
| `task --source slack --id <key> --owner <slack-user> --prompt-file <f> [--mcp <connectors>]` | exit 0 when the runner is booting |
| `steer <key> --message-file <f>` | exit 0 when the turn runs or is queued |
| `events <key> --since <cursor>` | JSON `{cursor, state, events: [{type, text, status?, options?}]}` |
| `diff <key>` | the working diff as text |
| `finish --session <key>` | exit 0 once the wrap-up starts; `events` later reports a `pr` or an `error` |
| `stop <key>` | exit 0 when the runner is gone |

Event types: `question` (with `options`), `turn_end` (with `status`: `needs-input` or `ready`), `pr` (with `url`), `error`. `state` is one of `starting`, `active`, `wrapping`, `pr_open`, `stopped`, `failed`.

## Who can do what

- Anyone in `ALLOWED_USERS` (`*` for everyone) in an `ALLOWED_CHANNELS` channel can start a session and steer any session in that channel, as in Claude Tag. The agent is told when a message is not from the person who started the session.
- `STEER` sets who steers a session. `mention` (the default): the person who started it, and anyone else allowed who tags the bot; an untagged reply from someone else is kept as context for the next turn. `anyone`: untagged replies steer too. `owner` also limits Interrupt, `!interrupt`, `!mute`, and 👎 to the person who started the session.
- Open PR, Stop, `!stop`, and `!restart` are always owner-only.

## Not in v0

- Take over, Try it, Screenshots, Tests.
- The idle sweep and resume.
- The voice model. The messages come from templates.
- Google group checks. `ALLOWED_USERS` is a static list.
