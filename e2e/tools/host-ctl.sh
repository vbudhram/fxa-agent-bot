#!/bin/bash
# The e2e fake controller (FAKE_CTL_INNER) plus a quick look's host writes, which fake-ctl.sh does not fake.
#   FAKE_HOST_WRITE   the host_write JSON that each quick look returns
#   FAKE_HOST_RESULT  ok (default); confirm: exit 3 unless --confirmed or --check; any other text: a refusal with that line (exit 1)
set -euo pipefail
case " $* " in
  *" session host-write "*)
    [ -z "${FAKE_CTL_LOG:-}" ] || printf '%s\0' "$@" | jq -cRs --argjson at "$(cat "$FAKE_NOW_FILE")" '{at: $at, argv: (split("\u0000")[:-1]), files: {}}' >> "$FAKE_CTL_LOG"
    w="$(cat)" r="${FAKE_HOST_RESULT:-ok}"
    case "$r" in
      ok) ;;
      confirm) case " $* " in *" --confirmed "* | *" --check "*) ;; *) echo needs-confirm >&2; exit 3 ;; esac ;;
      *) echo "$r" >&2; exit 1 ;;
    esac
    jq -c '{ok: true, op, url: (.url // "https://jira.example.com/browse/\(.key)")}' <<< "$w" ;;
  *" answer ask "*) "$FAKE_CTL_INNER" "$@" | jq -c --argjson h "${FAKE_HOST_WRITE:-null}" 'if .type == "answer" then . + {host_write: $h} else . end' ;;
  *) exec "$FAKE_CTL_INNER" "$@" ;;
esac
