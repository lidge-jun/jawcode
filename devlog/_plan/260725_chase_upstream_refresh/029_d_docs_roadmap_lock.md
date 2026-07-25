# 029 — wp2 D closeout + implementation roadmap lock

## Cycle summary

Docs-first cycle (wp2) closed 2026-07-25. 39 new chase cards documented and canon-synced; all gates for a docs-only cycle green.

| item | evidence |
|---|---|
| GJC delta documented | 10 cards (10.108–10.117), 529/529 hash-set (47fd456) |
| OMP delta documented | 29 cards (20.081–20.090, 20.101–20.112, 20.121–20.127), 1301/1301 hash-set across 3 bands (76202bf) |
| canon sync | MOCs Reviewed-through bumped, 007 session state, 002 snapshot, 009 tiers, bands no-change evidence (775f8c3) |
| stale-row repair | 28 MOC rows + 60+ broken canon links fixed (1022605); markerless-_fin batch queued to wp4 |
| C adversarial review | R1 FAIL (6 blockers) → synthesis 024 → all folded (7e58d6c, da1ceec, db6eda2) → R2 GO-WITH-FIXES (1 Medium residual, folded) |
| docs-only invariant | `git diff --name-only` for cycle touched only struct_har/chase + devlog + .codexclaw |

Terminal outcome: **DONE** (docs cycle).

## Roadmap lock — wp3 autonomous implementation queue (A bucket, A-slice where annotated)

Dependency-ordered (PHASE-SPLIT-01): platform/native foundations → provider/wire → session/tool correctness → docs evidence. One PABCD cycle per cluster; each cycle's P re-verifies its card against the current tree (stale check).

| order | decade | card(s) | scope |
|---|---|---|---|
| 1 | 030 | 10.116 (A-slice) | natives/Windows/platform import — welcome.ts slice excluded |
| 2 | 040 | 20.109 | tool/platform runtime hardening import |
| 3 | 050 | 20.081, 20.124 (A-slice) | AI catalog/stream/auth adapt + provider wire integrity |
| 4 | 060 | 20.082, 20.107 | session/context/settings + compaction/history resilience |
| 5 | 070 | 20.083 (A-slice), 20.087 | tool/fs/shell/git safety slice + native diff/search/memory perf |
| 6 | 080 | 20.088, 20.089 | release/build/platform/CI + runtime/stats/logging/collab |

wp3 cycles use decades 030–085; wp4 reconciliation uses 090; wp5 push record 095.

Remaining A cards folded into cycles by theme: 10.110 (SDK/ACP/bridge) → cycle 050-adjacent own cycle at 055 if scope demands; 10.112 (notifications/Telegram daemon) → own cycle 065; 20.102 (error notifications/terminal title) → cycle 080; 20.122 (TUI/tool lifecycle) → cycle 085; 10.117 (CI/release/docs evidence-fill) → wp4 evidence pass. Final assignment happens at each cycle's P against the then-current tree; this lock records the queue, not immutable boundaries.

## Deferred to user (C bucket, 17 cards) and backlog (B bucket, 7 cards)

Listed in 007_follow_index §2026-07-25 and 009_follow_tiers. Not touched autonomously.

## wp4 queue additions discovered this cycle

- 21 markerless _fin cards (from 753dc65/319c69d2): add closure headers (✅ _fin, Closed date, Decision Slots A–F) citing implementing commits (WP1–WP4 series ebaa081..5fb0837) or move back to active if claim unverifiable.
- `_fin/INDEX.md` sync for all moves.
