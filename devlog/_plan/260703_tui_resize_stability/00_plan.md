# 260703 — TUI resize/scroll corruption: stabilization slice map

## Loop continuity (LOOP-CONTINUITY-01)

Previous cycle: 260703 WP5 closed the multiplexer first-overflow materialization and
termux height-diff goldens (devlog/_plan/260702_tui_stabilization/60). Its D conclusion:
remaining corruption classes are policy-inherent (scrollback retention) or unfixed
structural gaps. This session's RCA (user screenshot: rows with horizontally-shifted
fragments, LEFT-cropped lines, floating right-aligned "jaw" labels; worst while resizing
or scrolling during streaming) identified four mechanisms:

- **R1 — terminal reflow vs immutable scrollback.** Width changes make reflowing
  terminals rewrap screen+scrollback. Frame lines are widely FULL-WIDTH padded
  (`padToWidth(..., lineWidth)` in `packages/coding-agent/src/tui/output-block.ts`,
  right-aligned labels in `composer-footer.ts:105`), so every padded line wraps into two
  rows on any width shrink. Renderer never repairs scrollback by policy (3J forbidden
  after committed history, `tui.ts` fullRender). Left-cropped fragments = wrap tails.
- **R2 — resize race → stale-width writes.** Streaming renders every 16ms read
  `process.stdout.columns` at render time; a render firing between the physical PTY
  resize and the Node resize event writes lines truncated to the OLD width. With DECAWM
  never disabled (no `CSI ?7l` anywhere in the repo), those writes physically wrap,
  inserting real rows and permanently desyncing the diff path's relative cursor moves
  (`#hardwareCursorRow` bookkeeping, no DSR/CPR re-sync). widthChanged compares stale
  values, so that render takes the diff path.
- **R3 — no autowrap guard + no cursor verification.** Any single overwide write (stale
  width or `Bun.stringWidth` vs terminal divergence) starts undetectable drift until the
  next absolute repaint; rows scrolled out during the drift window become permanent
  scrollback garbage.
- **R4 — user-observed healing on submit.** The submit path stabilizes because
  `realignOverflowedFrame()` resets all drift-prone bookkeeping and
  `compactViewportFill()` forces an absolute repaint, plus committed components shorten
  the frame. The healing half (absolute repaint + bookkeeping resync) is generalizable to
  more triggers; the realign/commit half is turn-boundary-only (preconditions:
  markable backlog, no overlay, commit lane).

External second opinions in flight (results folded in as they land): Codex gpt-5.5 xhigh
RCA (xterm-headless repro probes), ChatGPT Pro review with tui.ts/terminal.ts/
insert-history.ts attached.

GPT Pro round 1 (full text: session scratchpad `gpt-pro-answer.md`; conversation is being
continued per-WP with the pushed GitHub commits): confirmed R1–R3, re-ranked R2+R3 as the
dominant live-corruption mechanism, and added two findings of its own — (R5) a concrete
no-resize hazard: `#scrollOutCommittedRows()` mutates the terminal with DECSTBM
mid-`#doRender` while the already-captured locals (`hardwareCursorRow`,
`prevViewportTop`) and `#previousLines` (non-widened case) stay stale, so the same-pass
relative diff can paint fragments without any resize; and (R6) exact-width writes are a
deferred-wrap hazard — with DECAWM on, never write a printable cell into the last
column. Recommended minimum patch: DECAWM off + fresh ioctl size + post-DECSTBM resync.

User evidence round 2 (no resize, no scroll): right-aligned `Thinking … +3 lines` /
`jaw` labels drifting to random indents mid-stream; a tool line wrapping with tail
`evlo…`. Consistent with ambiguous-width mismatch (`…` `§` `✔` are East Asian AMBIGUOUS:
Bun.stringWidth 1 vs CJK-configured terminals 2) on full-width padded lines → R3.

User evidence round 3: the corrupted band renders like a block PINNED AT THE TOP that
re-asserts itself and interferes with native scrollback scrolling while streaming; same
sentences duplicated 2–4× at different wrap offsets. Points at the commit-lane
scroll-region machinery (R5) + per-frame absolute repaints fighting user scroll —
raises WP3 (scroll-out lane hardening) priority.

## Work-phase slice map (small → certain first; order per GPT Pro round 2 re-rank)

| WP | Slice | Class | Status |
|----|-------|-------|--------|
| WP1 | `TUI.resyncViewport()` one-shot absolute repaint primitive + resize flip-back trigger | C2 | DONE (0045e58) |
| WP2 | DECAWM off + emergency-restore hardening | C2 | DONE (fdb6e46, 3cc2689, ef481ba) |
| WP3a | scroll-out repaint barrier + liveZoneRepaint + round-4 fixes (overlay flush count, startRow guard) | C2 | DONE (f1078fe + follow-ups in 63a5493) |
| WP2.5 | ambiguous width through BOTH tables (pi-natives AtomicBool + Bun.stringWidth `ambiguousIsNarrow`) + CPR probe (`JWC_AMBIGUOUS_WIDTH` override) + commit gate + round-5 hardening (grace swallower, stdin gate, fail-closed setter) | C3 | DONE (63a5493, 036d1ab) |
| WP6a-A | fixed-height streaming preview for tool/thinking blocks | C2 | DONE (036d1ab) |
| WP3b-min | history-lane gating: canUseHistoryLaneNow + commitLines gate + flushHistoryLane at stream boundaries + mandatory-drain metric | C3 | this cycle (fable adversarial review pending) |
| WP6a-B | verbose always-expanded parity (gjc port) | C2 | next |
| WP6b | commit-on-completion (mid-turn commits behind the gate) | C3 | after 6a-B |
| WP5 | remove full-width literal padding; SGR-bg + EL/ECH with BCE detection, no-bg fallback | C3 | after WP6b |
| WP4 | render-time PTY size via ioctl(TIOCGWINSZ) + mustAbsoluteNextFrame | C3 | last |

One full PABCD cycle per WP; D of each cycle records evidence and re-enters P.

**Converged order (GPT Pro round 3, 260703 — agreed):** WP2.5 → WP3a → WP6a
(default/verbose render policy WITHOUT mid-turn commits: fixed-height preview +
collapsed/expanded-on-completion, commit still at turn boundary) → WP3b-min (history-
lane gating: no commit/drain while overlay open or off-bottom; queue/batch in mux or
unknown-bottom during streaming) → WP6b (enable commit-on-completion) → WP5 → WP4.
WP6 verdict: additive policy layer over the commit lane, materially shrinks the
corruption surface; semantic caveat — "committed" means "left the diff-rendered frame,
canonical pixels" but rows may stay PARKED on screen until drained, so WP3b is reduced
in scope but NOT obsoleted. WP2 verification: both commits correct; two hardening
follow-ups adopted (blind-restore in the active-terminal emergency branch too — a dead
ProcessTerminal no-ops #safeWrite and would skip ?7h; test asserting ?7l precedes any
printable write). Verbose-mode large one-shot commits get batched into one synchronized
write + resync barrier (WP6b detail). Image lines never go through the insert-history
lane. Full text: scratchpad `gpt-pro-answer-3.md`.

GPT Pro round 2 (full text: scratchpad `gpt-pro-answer-2.md`) — key deltas beyond the
re-rank: (a) WP1's flip-back does NOT fully replace a settle repaint — residual misses:
resize event sampled while process.stdout.columns is stale, coalesced/lost final event,
same-grid physical changes (font zoom, mux reattach), and the resync guard DROPPING the
one-shot flag when it refuses (keep it pending instead — fold into WP3a). Deterministic
alternative: resizeDirtyEpoch + mustAbsoluteNextFrame + fresh size read (→ WP4).
(b) DECAWM: EL/ECH semantics unaffected; treat tmux as pane-local; image lines are a
separate row-stability class (isImageLine bypasses width prep — needs its own barrier
eventually). (c) `✔` is not reliably EAW-A — class the mismatch as
"ambiguous/emoji/symbol width", probe with §/…/·. Vim prior art: t_u7 CPR ambiwidth
detection. (d) Commit-lane safety contract (WP3b): skip DECSTBM insertion while
isViewportAtBottom() === false, queue in virtual history, flush at bottom/agent_end/
submit/Ctrl+L; be conservative in mux when the hook is undefined.

## WP1 detail

See `10_wp1_resync_viewport.md`.
