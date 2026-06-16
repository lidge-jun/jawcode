# P1.5.2 D-stage summary

## P / A / B / C

- P: Planned the final P1.5 lane as a manual `session-manager.ts` resident-cache merge, preserving P1.5.1/P1.5.3/P1.5.4/P1.5.5 and avoiding wholesale upstream replacement.
- A: Planner and Architect audits initially failed; synthesis `57_p1_5_2_audit_synthesis_r0.md` revised the plan, and both lenses passed revision `a-r1`.
- B: Implemented split resident text/image ownership, fail-closed resident image materialization, lifecycle reset/re-externalize, detached bounded snapshots, restore materialization, and optional model-change provenance.
- C: First adversarial review failed on focused test coverage gaps; B retry added `newSession`, `setSessionFile`, `moveTo`, and organic snapshot reset tests; C retry passed with workspace and focused gates green.

## Files changed

- `packages/coding-agent/src/session/blob-store.ts`
- `packages/coding-agent/src/session/session-manager.ts`
- `packages/coding-agent/test/session-resident-cache.test.ts`
- `packages/coding-agent/test/session-resident-lifecycle.test.ts`
- `packages/coding-agent/test/session-resident-ownership.test.ts`
- `packages/coding-agent/test/resident-materialization.test.ts`
- `devlog/_plan/260614_performance/53_p1_5_2_resident_cache_plan.md`
- `devlog/_plan/260614_performance/54_p1_5_2_critic_synthesis_round1.md`
- `devlog/_plan/260614_performance/55_p1_5_2_audit_planner_r0.md`
- `devlog/_plan/260614_performance/56_p1_5_2_audit_architect_r0.md`
- `devlog/_plan/260614_performance/57_p1_5_2_audit_synthesis_r0.md`
- `devlog/_plan/260614_performance/58_p1_5_2_audit_planner_r1.md`
- `devlog/_plan/260614_performance/59_p1_5_2_audit_architect_r1.md`
- `devlog/_plan/260614_performance/60_p1_5_2_b_summary.md`
- `devlog/_plan/260614_performance/61_p1_5_2_b_verifier_done.md`
- `devlog/_plan/260614_performance/62_p1_5_2_c_adversarial_fail.md`
- `devlog/_plan/260614_performance/63_p1_5_2_b_fix_summary.md`
- `devlog/_plan/260614_performance/64_p1_5_2_b_verifier_r2_done.md`
- `devlog/_plan/260614_performance/65_p1_5_2_c_check_pass.md`

## Acceptance criteria met

- Persistent resident text cache no longer uses an unbounded `MemoryBlobStore`; persistent text residents use temp-backed `EphemeralBlobStore` and close-time cleanup is tested.
- Persistent resident image sentinels stay durable-blob-store owned and fail closed during resident materialization.
- Durable persisted image refs keep non-throwing load compatibility.
- Resident lifecycle paths are covered for open/reload, setSessionFile, newSession, restoreState, fork, createBranchedSession, moveTo, close, rewrite/persist, and reader APIs.
- `captureState()` remains bounded and detached; `restoreState()` materializes before resetting/re-externalizing.
- `buildSessionContext()` compaction hydration clamp remains covered.
- Optional `ModelChangeEntry` provenance fields are preserved without changing current model selection.

## WONDER

- Large resident text is intentionally not durable after process-close/reopen; persisted oversized text remains truncated. The plan had to be sharpened during B to distinguish durable image recovery from temp-backed text residency.
- The first C review caught that implementation success alone was insufficient: lifecycle acceptance criteria needed direct focused tests for `newSession`, `setSessionFile`, and `moveTo`.
- Temp resident cleanup is tested by prefix-scanning `os.tmpdir()`; a future dedicated test seam for resident cache dirs would be less environmental.

## REFLECT

- P1.5.2 acceptance criteria should explicitly separate runtime resident-cache behavior from persisted JSONL recovery semantics.
- Future resident-cache specs should enumerate lifecycle transitions and tests before implementation, not rely on broad “reset/re-externalize” wording.
- The upstream `cloneSessionContext` term should be translated to jawcode's actual local symbols (`buildSessionContext`, reader APIs, and `captureState`/`restoreState`) in the parent plan to avoid ambiguous cache requirements.

## Close

P1.5.2 is complete and checked. This closes the remaining implementation lane for the active P1.5 upstream Optimization Suite v3 goal; a final goal audit follows after PABCD close.
