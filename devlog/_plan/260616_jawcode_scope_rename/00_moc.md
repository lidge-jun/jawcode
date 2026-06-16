# @gajae-code → @jawcode Scope Rename — MOC

Created: 2026-06-16
Status: Plan ready for execution

## Scale

| Metric | Count |
|---|---|
| Total @gajae-code occurrences | ~5,200+ |
| Source imports (src/) | 1,171 |
| Test imports (test/) | 2,114 |
| Package.json refs | 58 (names + deps + catalog + repo URLs) |
| Script/gate refs | 48 |
| Test fixture refs | 186 (serialized session data) |
| Files affected | ~300+ |
| Packages to rename | 10 |

## Package Rename Map

| Current | Proposed |
|---|---|
| `@gajae-code/utils` | `@jawcode/utils` |
| `@gajae-code/ai` | `@jawcode/ai` |
| `@gajae-code/natives` | `@jawcode/natives` |
| `@gajae-code/tui` | `@jawcode/tui` |
| `@gajae-code/stats` | `@jawcode/stats` |
| `@gajae-code/agent-core` | `@jawcode/agent-core` |
| `@gajae-code/coding-agent` | `@jawcode/coding-agent` |
| `@gajae-code/bridge-client` | `@jawcode/bridge-client` |
| `@gajae-code/typescript-edit-benchmark` | `@jawcode/typescript-edit-benchmark` |
| `@gajae-code/orchestration-token-benchmark` | `@jawcode/orchestration-token-benchmark` |
| `gajae-code` (root) | `jawcode-monorepo` (private, not published) |
| `gajae-code` (packages/gajae-code) | DELETE or `jawcode-compat` |

## Prerequisite

**npm에서 `@jawcode` org 생성 필요** — https://www.npmjs.com/org/create
이거 먼저 해야 패키지 publish 가능.

## Execution Phases (병렬 가능)

### Phase 1: Package Manifests (~15 files)
- 모든 `packages/*/package.json` name 필드 변경
- Root `package.json` catalog `@gajae-code/*` → `@jawcode/*`
- `packages/jwc/package.json` deps + bundle externals
- `bun install` → `bun.lock` 재생성

### Phase 2: Source Imports (~1,300 files, 병렬 6개)
Global text replace: `@gajae-code/` → `@jawcode/`
대상: `packages/*/src/**/*.ts`

병렬 분할:
1. `packages/coding-agent/src/` (1,020 refs)
2. `packages/ai/src/` (62 refs)
3. `packages/agent/src/` + `packages/tui/src/` (52 refs)
4. `packages/stats/src/` + `packages/utils/src/` + `packages/jwc/` (18 refs)
5. `packages/natives/` + benchmarks (6 refs)
6. `scripts/` + root configs (42 refs)

### Phase 3: Tests (~600 files, 병렬 4개)
Global text replace: `@gajae-code/` → `@jawcode/`
대상: `packages/*/test/**/*.ts` + test fixtures

1. `packages/coding-agent/test/` (1,784 refs)
2. `packages/ai/test/` + `packages/tui/test/` (257 refs)
3. `packages/agent/test/` + others (73 refs)
4. Test fixtures (186 refs — serialized JSON, careful with encoding)

### Phase 4: Gates, CI, Docs (~20 files)
수동 정밀 수정:
- `scripts/rebrand-inventory.ts` — expectedPackageScope
- `scripts/verify-g002-gates.ts` — 27 refs, scope checks
- `scripts/check-public-legacy-zero.ts` — allowlist
- `scripts/release.ts` — catalog regex
- `scripts/jwc-release-validation.ts` — dep version match
- `scripts/install-tests/run-ci.sh` — npm overrides
- `AGENTS.md` — upstream attribution
- `Cargo.toml` — repo URL
- `python/robojwc/tests/test_natives_cache.py`

### Phase 5: Verify
- `bun install` (lockfile regen)
- `bun run ci:check:full`
- `bun run ci:test:smoke`
- `bun scripts/rebrand-inventory.ts --strict`
- `bun scripts/verify-g002-gates.ts`
- `npm pack --dry-run` in packages/jwc

## NOT Changing
- `ENGINE_NAME = "gjc"` (internal log path identifier)
- `devlog/_upstream_gjc/` (upstream snapshot)
- `struct_har/gjc_origin/` (comparison data)
- Rust crate name `pi-natives` (unrelated to npm scope)
- `packages/gajae-code/` (private compat wrapper — review for deletion)

## Risk
- **npm @jawcode org must exist first** — create before Phase 1
- ast_edit may miss string literals in serialized fixtures — text replace fallback
- bun.lock regen may surface unrelated dep changes
- Gate scripts (verify-g002-gates) are the most fragile — 27 hardcoded scope refs

## Execution: 다른 세션에서 PABCD B-stage 병렬 subagent로 실행
