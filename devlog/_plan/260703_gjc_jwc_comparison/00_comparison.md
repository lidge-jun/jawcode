# 260703 gajae-code vs Jawcode 비교

Status: comparison note
Owner: Boss
Created: 2026-07-03
Work class: C1 docs-only

## Scope

여기서 "가재코드"는 upstream `Yeachan-Heo/gajae-code` chase clone(`devlog/_gjc_chase/gajae-code`)을 뜻하고, "너"는 이 세션의 말투가 아니라 이 repo의 Jawcode/JWC 제품 표면을 뜻한다. 감정 비교가 아니라 제품·런타임·운영 표면 비교다. 아쉽게도 자아비교까지 하면 devlog가 아니라 일기장이 된다.

## Evidence read

- `AGENTS.md` defines `packages/coding-agent/` as the primary product surface and fixes the public workflow surface to `jaw-interview`, `plan`/`jwc orchestrate`, `goal`/`jwc goal`, and `team`.
- `devlog/README.md:8-16` says Jawcode-specific planning and reference context lives under `devlog/`, while upstream-owned docs remain at root for rebase safety.
- `struct_har/README.md:1-6` defines `struct_har/` as the `gjc_origin` ↔ `jwc_patched` comparison layer.
- `struct_har/README.md:10-18` records the current reviewed-through baselines for GJC, JWC, and OMP chase sources.
- `struct_har/README.md:85-96` already summarizes the transverse GJC-vs-JWC product deltas.
- `structure/40_fork-delta.md:173-188` lists the major logic-change axes: surface, paths, interview, PABCD, goal, skills, prompts, TUI, auth, cursor, guards, and extensions.
- `structure/40_fork-delta.md:228-246` records the native `orchestrate` and `goal` additions.
- `structure/40_fork-delta.md:286-300` records the `.jwc` migration, `JWC_*` env chain, and `jwc://` URL scheme.
- `structure/50_status.md:21-35` records current readiness: daily coding, semi-autonomous IPABCD/PABCD, `jwc memory`, `jwc goal`, and reset/cancel paths work.
- `devlog/_gjc_chase/gajae-code/packages/gajae-code/package.json:3-6,29-34` shows upstream package `gajae-code`, bin `gjc`, wrapper dependency on `@gajae-code/coding-agent`.
- `packages/jwc/package.json:3-23,39-46` shows JWC package `jawcode`, bin `jwc`, and `jawcode/sdk`/Node build/runtime scripts.

## One-line verdict

Gajae-code is the upstream coding-agent fork surface centered on `gjc`; Jawcode is the operator-heavy downstream product that keeps upstream lineage but replaces the public contract with `jwc`, `.jwc`, native IPABCD/PABCD orchestration, goal ledgers, cli-jaw skill integration, extra providers/auth handling, and a much more opinionated TUI/runtime discipline.

## Comparison table

| Axis | gajae-code / GJC | Jawcode / JWC |
|---|---|---|
| Public package | `gajae-code` package, `gjc` bin. | `jawcode` package, `jwc` bin, `jawcode/sdk` export surface. |
| Primary command identity | `gjc` first. | `jwc` only for public docs and commands; legacy aliases exist only where compatibility is intentional. |
| Runtime state path | Upstream lineage uses/transitioned around `.gjc`/`.jwc` depending surface. | `.jwc/` is the canonical runtime state/spec/plan/goal path; migration from `.gjc` is one-time and guarded. |
| Workflow model | Bundled GJC workflow skills: `deep-interview`, `ralplan`, `ultragoal`, `team`. | Public workflow surface: `jaw-interview`, native `jwc orchestrate`, `jwc goal`, `team`; legacy `plan` skill is compatibility/superseded. |
| Planning | Skill-loop planning (`ralplan`) is the upstream planning idiom. | Native IPABCD/PABCD state machine owns planning/audit/build/check/done; `plan` is not the new source of truth. |
| Execution ledger | `ultragoal` lineage. | `jwc goal` public ledger with `.jwc/goal/` evidence and native integration with orchestrate artifacts. |
| Prompt identity | GJC/gajae-code identity and upstream prompt surface. | Jaw/Jawcode identity, jwc-native routing rules, role-agent allowlists, `/tone` identity injection. |
| Skill discovery | GJC defaults plus project/user skill roots. | JWC defaults plus cli-jaw global skill substitution/ignore rules; public workflow count is intentionally fixed. |
| TUI product stance | Upstream/default TUI direction. | User-curated Jawcode TUI: abyss-bite theme, welcome banner discipline, viewport pin/fill behavior, tool folding/live-zone routing. |
| Providers/auth | Upstream provider/auth baseline. | Additional local token import/detection, OAuth hardening, Kiro/Grok/OpenAI Codex-related paths, stale credential cleanup. |
| Extensibility | Upstream plugin/MCP/tool surface. | Adds `computer_use` lazy backend and Hermes/coordinator MCP bridge surfaces. |
| Documentation model | Upstream docs plus chase clone baseline. | `AGENTS.md` + `structure/` as current SoT, `struct_har/` for side-by-side comparison, `devlog/` for plan/evidence history. |
| Rebase posture | Source of incoming upstream work. | Downstream fork with explicit HARD-EDIT / INVERTED-GUARD / NEW / REMOVED tracking in `structure/40_fork-delta.md`. |

## What JWC adds beyond a rename

1. **Native orchestration, not just branding.** `jwc orchestrate i|p|a|b|c|d` is a native workflow engine with state, prompts, audit lanes, verdict capture, and phase gates. That is a product-level behavior difference, not a `s/gjc/jwc/` paint job.
2. **A stricter public workflow surface.** JWC deliberately limits public workflows to `jaw-interview`, `plan`/`orchestrate`, `goal`, and `team`; role agents are callable but not workflow skills. This prevents every clever internal helper from becoming a user-facing workflow by accident, because apparently software needs doors instead of holes in the wall.
3. **`.jwc` as the canonical operator state path.** State, specs, plans, ledgers, sessions, and runtime guidance converge under `.jwc/`, with migration/compatibility for legacy names where needed.
4. **Goal and planning are integrated.** `goal` does not pretend missing planning is fine; it routes through orchestrate P when approval/consensus artifacts are absent.
5. **Fork delta is operationalized.** `structure/40_fork-delta.md` records conflict-prone hard edits, inverted guards, removals, and new fork-only files so upstream pulls can be merged deliberately instead of by heroic vibes.
6. **Operator UX is product, not decoration.** The TUI banner, scroll model, tool rendering, command surfaces, and live-zone behavior are preserved as explicit product contracts.
7. **Docs are layered.** `structure/` is current truth, `struct_har/` is comparison/harness, and `devlog/` is execution/evidence history. GJC is the baseline; JWC is the patched product.

## What GJC still contributes

- It remains the primary upstream source for coding-agent runtime changes, provider improvements, TUI fixes, and broad agent behavior deltas.
- `devlog/_gjc_chase/gajae-code/` and `struct_har/gjc_origin/` are still the comparison baseline for chase/import decisions.
- JWC should not blindly reject upstream changes; it should import/adapt them through the fork-delta boundaries. The upstream is not obsolete — it is the quarry. JWC is the house built from the rocks, with more warning signs taped to the wiring.

## Practical conclusion

Use GJC as upstream source material and regression reference. Use JWC as the active product/runtime contract. When they disagree, preserve JWC public surfaces (`jwc`, `.jwc`, `jaw-interview`, native `orchestrate`, `goal`, fixed workflow count, curated TUI) unless a new explicit product decision changes the contract.
