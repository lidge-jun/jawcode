# 61 — WP6a Slice A: fixed-height streaming preview for tool/thinking blocks

## Loop continuity

WP2.5 shipped (63a5493). GPT Pro round-5 (WP3b-min gating policy) is in flight — Slice A
is commit-lane-independent (pure render shaping), so it runs now; 3b-min follows the
external answer. Research base: 60_wp6_implementation_map §1/§4/§5-A.

## What (Part 1)

While a tool is RUNNING (`#isPartial`, default mode, not ctrl+o-expanded), its block no
longer grows unboundedly with streaming output: it renders head rows (separator + title)
+ a dim `… +K lines` elision marker + the last N output rows — a fixed-height window,
Claude Code-style. Same for the live streaming thinking tail (marker + last N lines
instead of the full trace). On completion the existing paths take over unchanged
(commit mode: minimize + hand-off; verbose: full render). Corruption relevance: the live
zone stops overflowing the viewport during long tool runs, which keeps the commit lane
alive (fill > 0), avoids the overflow machinery, and shrinks scroll-out churn.

## Diff plan (Part 2)

### MODIFY packages/coding-agent/src/modes/components/tool-execution.ts

- Constants: `STREAMING_PREVIEW_HEAD = 2`, `STREAMING_PREVIEW_TAIL = 5`.
- In `override render(width)` (currently: minimized branch → `super.render(width)` +
  height cache): after caching `#expandedLineCountsByWidth` (must record the FULL
  height for the minimized `+K lines` meta), apply
  `#capStreamingPreview(lines)` when `#isPartial && !#expanded && !#fullTranscript`:
  if `lines.length > HEAD + 1 + TAIL`, return
  `[...head, dim elision marker, ...tail]`. bash/eval already self-cap via
  `previewLines` (their output stays under the threshold → cap no-ops, no double-cap).
- ctrl+o (`#expanded`) and the transcript overlay (`#fullTranscript`) bypass the cap.

### MODIFY packages/coding-agent/src/modes/components/assistant-message.ts

- Split the `#thinkingExpanded || isStreamingTail` branch: expanded → full (unchanged);
  `isStreamingTail && !#thinkingExpanded` → marker line
  (`Thinking … +K lines` in the existing collapsed style) + a Text of the LAST
  `THINKING_STREAM_TAIL_LINES = 4` logical lines (built fresh each update — the
  streaming block mutates every message_update, so no identity cache).
- Logical-line cap (pre-wrap) accepted for v1: exact visual capping needs width at
  build time; the frame still shrinks by orders of magnitude.

### Tests

- NEW packages/coding-agent test: streaming tool block with 40 output lines renders ≤
  HEAD+1+TAIL body rows while partial and the marker counts the hidden rows; expanded
  bypasses; completed result renders unchanged. Thinking streaming tail caps at 4 +
  marker; expanded shows full.
- Risk: existing tool-rendering tests/goldens asserting full streaming bodies — run the
  coding-agent suite and adjust only fixtures that encode the OLD unbounded behavior.
