// The live status message every member of the thread sees: a title line and, while
// a turn runs, a code block that always holds the newest BOX_LINES lines. Slack cannot
// scroll inside a message, so older rows fold into one "Earlier" line.
export const BOX_LINES = 5;
const CMD_MAX = 90;
const count = /^(.*?) · (\d+) steps?$/;

function earlier(rows) {
  const old = rows.map((r) => r.replace(/^[✓›○] /, ''));
  const n = old.reduce((a, r) => a + Number(r.match(count)?.[2] ?? 0), 0);
  return `✓ Earlier · ${old.map((r) => r.match(count)?.[1] ?? r).join(', ').slice(0, 80)}${n ? ` · ${n} steps` : ''}`;
}
// rows: ✓ done, › current (at most one), ○ open todos. The command goes under the current row;
// only rows before it fold, and open todos past the room become one "more" line.
export function boxLines(rows, cmd) {
  const tail = cmd ? [`    $ ${String(cmd).replace(/\s+/g, ' ').slice(0, CMD_MAX)}`] : [];
  let cur = rows.findLastIndex((r) => r.startsWith('›'));
  if (cur < 0) cur = rows.length - 1;
  let before = rows.slice(0, cur), after = rows.slice(cur + 1);
  const mid = rows.slice(cur, cur + 1);
  const size = () => before.length + mid.length + tail.length + after.length;
  const k = Math.min(size() - BOX_LINES + 1, before.length);
  if (size() > BOX_LINES && k > 1) before = [earlier(before.slice(0, k)), ...before.slice(k)];
  if (size() > BOX_LINES) {
    const room = BOX_LINES - 1 - before.length - mid.length - tail.length;
    after = [...after.slice(0, room), `○ ${after.length - room} more`];
  }
  return [...before, ...mid, ...tail, ...after];
}

// The box keeps its height early in a turn: Slack may drop trailing blank lines, not a no-break space.
export function statusMessage({ title, rows = [], cmd }) {
  const lines = rows.length ? boxLines(rows, cmd) : [];
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: title } }];
  if (lines.length) {
    const padded = [...lines, ...Array(BOX_LINES - lines.length).fill(' ')];
    blocks.push({ type: 'rich_text', elements: [{ type: 'rich_text_preformatted', elements: [{ type: 'text', text: padded.join('\n') }] }] });
  }
  return { text: [title, ...lines].join('\n'), blocks };
}
