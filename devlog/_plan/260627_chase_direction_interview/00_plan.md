# chase direction interview — undecided card directions

> Pass type: **direction-deciding interview** (PABCD state I) feeding the active goal
> Goal ID: `51f512f6-914` — "확정 chase 카드를 한 카드=한 작은 PABCD로 _fin 마감".
> Snapshot: GJC `f0a8a3eb` (`upstream/dev`) · JWC worktree `da23db8` · OMP `0fc6d136` (`origin/main`).
> Date: 2026-06-27.

## Objective

Decide the **import / adapt / reject / split / defer** direction for the chase cards
that still have an **empty** `## Confirmed decisions` block, so each either joins the
goal's close-queue (adapt) or closes fast as a reference/reject card. Record every
decision into its card (the "devlog 보강" the user asked for) with evidence, one card
per tiny PABCD cycle afterward.

User instruction this pass: *"방향성 결정 인터뷰 하면서 너가 devlog 보강하자 elici로 질문해."*
→ The direction calls are **product judgments** (which upstream behavior to adopt vs
reject), surfaced to the user via an `elicitation` fence; this doc records the research
and proposals behind those questions.

## Current facts (verified 2026-06-27)

### Card-state map — `struct_har/chase/[12]0.*.md` (22 active cards)

| state | count | cards |
|-------|-------|-------|
| ✅ decided (Confirmed decisions filled) | 11 | 10.002 · 10.003 · 10.005 · 10.007 · 10.012 · 10.019 · 10.021 · 10.023 · 10.024 · 20.005 · 20.006 |
| ⬜ **undecided gap** (this interview) | **9** | 10.006 · 10.013 · 10.020 · 10.025 · 20.002 · 20.003 · 20.004 · 20.007 · 20.008 |
| ⚙️ cycle/process (not a gap) | 2 | 10.001 · 20.001 |

Verification: `grep -c "Confirmed decisions"` over each card file.

### Goal ↔ card discrepancy (must reconcile)

The active goal's target list and the real decided/undecided state disagree on two cards:

| card | in goal target list? | Confirmed decisions? | note |
|------|:--:|:--:|------|
| **20.008** pull_15_13_delta | **yes** | **0 (undecided)** | 🟡 index/routing card — sits in the goal close-queue but has no decision block |
| **10.019** gc_file_lock | **no** | **1 (decided)** | decided in the 2026-06-26 interview pass but omitted from the goal list |

→ The goal says "Decision 테이블이 채워진 확정 카드들"; 20.008 does not meet that criterion
and 10.019 does. This pass resolves it: 20.008 gets an explicit direction (likely "confirm
as index card") and 10.019 is noted as already-decided and eligible for the close-queue.

### Decision-relevant source verification

- **10.013 assistant_msg_cache — gap is real.**
  - GJC clone HAS the optimization:
    `devlog/_gjc_chase/gajae-code/packages/coding-agent/src/modes/components/assistant-message.ts`
    — `#contentBlocksCache = new WeakMap(...)` (L21), `#renderTextBlock` (L110), `#renderThinkingBlock` (L128).
  - JWC LACKS it: `rg contentBlocksCache packages/` → no match.
  - JWC HAS thinking collapse that upstream lacks:
    `packages/coding-agent/src/modes/components/assistant-message.ts` — `#thinkingExpanded` (L21),
    `setThinkingExpanded` (L59), `setExpanded` ctrl+o sweep (L72), "devlog 083.5".
  - ⇒ The card's reconcile note is accurate: a port must keep the cache key on content-block
    identity and coexist with `#thinkingExpanded` collapse state.
- **20.003 memory_skills — reference close is safe.** `99.01 ✅` (memory CLI done) per
  `struct_har/chase/006_jwc_own_backlog.md`; mnemopi maps to the already-shipped 99.01.

## Proposed directions (pending user elicitation answers)

Each undecided card already carries a directional hint in its own body; proposals below
restate it in import/adapt/reject/split/defer terms. **Not yet committed into the cards.**

| card | what it is | hint in card | proposed direction |
|------|-----------|--------------|--------------------|
| 20.002 worker_catalog | omp workerHost / pi-catalog | "pi-catalog 비채택 D4" | **reject/reference** → 1 cross-ref line → `_fin/20/` |
| 20.003 memory_skills | mnemopi / `.omp/skills` | "mnemopi→99.01 완료, →D5" | **reference (covered)** → 1 line → `_fin/20/` |
| 20.004 lsp_dap | omp LSP·DAP bench | "jaw 선택 포팅만" | **reference/defer** → candidate list → `_fin/20/` |
| 20.008 pull_15_13_delta | 🟡 routing index | "본 표만 갱신" | **confirm as index card** (resolves goal discrepancy) |
| 10.020 deep_interview | semantics (MLB 45) | "체리픽 금지, 참조 우선" | **reference-only** (devlog records adopt/reject, no code) |
| 10.025 perf_corpus/geobench | bench (MLB 40) | "ledger 패턴만, YAML 복사 금지" | **reference** (+optional ledger → 99.02 CI) |
| 20.007 session_modularization | design (MLB 50) | "경계만 채굴, 1:1 복사 금지" | **reference-only** (refactor sketch, no behavior change) |
| 10.013 assistant_msg_cache | pure-perf WeakMap cache | "P3, collapse 공존" | **adapt candidate** — the only real-code call |
| 10.006 tui_core | upstream bugfixes | "082/083 분리 후만" | **defer/conditional** (gated behind 082/083) |

## Open elicitation questions (asked this pass)

1. **ref_batch** — omp reference/reject 4종 (20.002 · 20.003 · 20.004 · 20.008):
   close_now (all 4 → `_fin`) / hold_lsp (keep 20.004) / keep_active.
2. **code_card** — 10.013 assistant_msg_cache:
   adapt_now (tiny PABCD, collapse coexistence test) / defer_p3 / investigate-first.
3. **ref_design** — reference/design 4종 (10.020 · 10.025 · 20.007 · 10.006):
   ref_close (reference-only → `_fin`) / spinoff (reference + follow-up adapt card) / defer.

## Next steps (after answers)

1. Write each card's `## Confirmed decisions (2026-06-27 interview)` block (slots A–H) per
   the chosen direction — **this is the devlog 보강**.
2. `adapt` cards join the goal close-queue; `reference/reject` cards get evidence + move to
   `struct_har/chase/_fin/{10,20}/`, then update `10_/20_` MOC and `007_follow_index.md`.
3. Reconcile the goal list (add 10.019, settle 20.008 as index) when its direction is set.
4. Run one tiny PABCD cycle per card, each closed by C→D with a fresh verification tail.

## Commit scope (this pass)

- `devlog/_plan/260627_chase_direction_interview/00_plan.md` (this file) only.
- No card edits until the user's direction answers arrive (no business decision pre-empted).

## Status

- [x] Research: card-state map, goal/card discrepancy, 10.013 + 99.01 source verification.
- [x] devlog record created (this file).
- [ ] User elicitation answers (ref_batch / code_card / ref_design).
- [ ] Card decision blocks written + cards closed to `_fin` per direction.
