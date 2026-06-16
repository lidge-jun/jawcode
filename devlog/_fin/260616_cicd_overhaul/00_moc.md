# CI/CD Overhaul — MOC

Created: 2026-06-16
Status: I-stage (interview/investigation)

## Objective

jawcode CI/CD 파이프라인 정비:
1. npm publish smoke test 실패 수정 (`gjc/0.4.4` → `jwc/1.0.0`)
2. CI 시간 단축 (~12min → target <6min)
3. Release 시간 단축 (~16min → target <8min)
4. gjc 잔재 제거 (CI/install/user-facing)
5. `npm install jawcode` → `jwc` 정상 동작 보장

## Investigation Subagents (parallel)

| ID | Scope | Status |
|---|---|---|
| CiTimingBreakdown | CI 타이밍 분석, 중복 step 식별 | running |
| GjcRemnantAudit | gjc 잔재 분류 (REMOVE/KEEP-COMPAT/KEEP-INTERNAL) | running |
| PublishPipelineAudit | npm publish 파이프라인 E2E 감사 | running |
| CiCacheStrategy | GHA 캐싱/아티팩트 전략 설계 | running |

## Known Facts (pre-investigation)

### Root Cause: gjc/0.4.4
- `packages/jwc/package.json` dep `"@gajae-code/natives": "0.4.4"` (hardcoded)
- Workspace natives is `1.0.0` → npm installs 0.4.4 from registry as nested dep
- Published `jawcode@1.0.0` on npm works correctly (verified: `jwc/1.0.0`)
- CI smoke test (`smoke-packed-sdk.mjs`) fails because it packs from workspace

### CI Timing
- `bun install` ~85s (includes prepare script)
- `build:native` (Rust compile) ~5min
- `package` job re-does both from scratch (no artifact sharing)
- `release.yml` re-runs `ci:check:full` redundantly

### gjc Remnants
- `packages/gajae-code/` — private package, gjc bin wrapper
- `ENGINE_NAME = "gjc"` — intentional internal identifier
- Docker scripts reference `gajae-code/pi:dev`
- Install test scripts reference `gjc`
- Benchmark scripts reference `gjc-bin`

## Phase Plan

| Phase | Content | File |
|---|---|---|
| 10 | Investigation synthesis (subagent results) | `10_investigation_synthesis.md` |
| 20 | Decision record (interview) | `20_decisions.md` |
| 30 | PABCD P-stage plan | `30_plan.md` |
