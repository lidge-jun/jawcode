# @gajae-code → @jawcode Scope Rename — Loop Plan MOC

Created: 2026-06-16
Status: Loop plan active

## Loop Phases

| Phase | Description | Status | Cycle |
|---|---|---|---|
| 0 | npm @jawcode org 생성 (수동) | pending | — |
| 1 | Package manifests (name, deps, catalog) + bun.lock | pending | PABCD-1 |
| 2 | Source imports bulk replace (~1,300 files) | pending | PABCD-2 |
| 3 | Test imports bulk replace (~600 files) + fixtures | pending | PABCD-2 (병합) |
| 4 | Gates, CI, scripts, docs (~20 files) | pending | PABCD-3 |
| 5 | Verify + publish jawcode@1.0.2 | pending | PABCD-3 (병합) |

## Scale

| Metric | Count |
|---|---|
| Total @gajae-code occurrences | ~5,200+ |
| Source imports (src/) | 1,171 |
| Test imports (test/) | 2,114 |
| Package.json refs | 58 |
| Script/gate refs | 48 |
| Test fixture refs | 186 |
| Files affected | ~300+ |
| Packages to rename | 10 |

## Package Rename Map

| Current | Proposed |
|---|---|
| `@gajae-code/utils` | `@jawcode-dev/utils` |
| `@gajae-code/ai` | `@jawcode-dev/ai` |
| `@gajae-code/natives` | `@jawcode-dev/natives` |
| `@gajae-code/tui` | `@jawcode-dev/tui` |
| `@gajae-code/stats` | `@jawcode-dev/stats` |
| `@gajae-code/agent-core` | `@jawcode-dev/agent-core` |
| `@gajae-code/coding-agent` | `@jawcode-dev/coding-agent` |
| `@gajae-code/bridge-client` | `@jawcode-dev/bridge-client` |
| `@gajae-code/typescript-edit-benchmark` | `@jawcode-dev/typescript-edit-benchmark` |
| `@gajae-code/orchestration-token-benchmark` | `@jawcode-dev/orchestration-token-benchmark` |
| `gajae-code` (root private) | `jawcode-monorepo` |

## Cycle Details

### PABCD-1: Package Manifests
**Scope**: ~15 files
- All `packages/*/package.json` name fields
- Root `package.json` name + catalog entries
- `packages/jwc/package.json` deps + bundle --external
- `packages/jwc/scripts/resolve-bun-runtime.cjs` (if any refs)
- `bun install` → `bun.lock` regen
- `bun run generate-schemas` (if schema references scope)

**Acceptance**: `bun install --frozen-lockfile` fails (expected, new lockfile), `bun install` succeeds, all package.json names are `@jawcode-dev/*`

### PABCD-2: Source + Test Imports
**Scope**: ~1,900 files, ~3,300 refs
- Global text replace `@gajae-code/` → `@jawcode-dev/` across `packages/*/src/**/*.ts` and `packages/*/test/**/*.ts`
- Test fixtures (serialized JSON — careful with escaping)
- Parallelizable: 6 source workers + 4 test workers

**Acceptance**: `bun run check:ts` passes (all imports resolve), no `@gajae-code/` in src/ or test/ except excluded paths

### PABCD-3: Gates + CI + Docs + Verify + Publish
**Scope**: ~20 files manual + full verification
- `scripts/rebrand-inventory.ts` — expectedPackageScope → `@jawcode-dev/`
- `scripts/verify-g002-gates.ts` — 27 refs, scope constants
- `scripts/check-public-legacy-zero.ts` — allowlist
- `scripts/release.ts` — catalog regex
- `scripts/jwc-release-validation.ts` — dep version match refs
- `scripts/ci-release-publish.ts` — package list
- `scripts/install-tests/run-ci.sh` — npm overrides
- `AGENTS.md` — scope references
- `Cargo.toml` — repo URL
- Version bump → 1.0.2
- Full verify: `ci:check:full` + `ci:test:smoke` + gates
- Push + release

**Acceptance**: All gates green, `npm publish` succeeds as `jawcode@1.0.2` with `@jawcode-dev/natives` dep

## NOT Changing (Explicit Exclusions)
- `ENGINE_NAME = "gjc"` — internal log path identifier
- `devlog/_upstream_gjc/` — upstream snapshot
- `struct_har/gjc_origin/` — comparison data
- Rust crate name `pi-natives` — unrelated to npm scope
- `packages/gajae-code/` — DELETE after rename (gjc compat wrapper, private)
- Any `@gajae-code` in devlog `_fin/` or `_reference/` (historical)

## Prerequisite (Phase 0)
**npm에서 `@jawcode` org 생성**: https://www.npmjs.com/org/create
이거 먼저 완료 후 Phase 1 시작.

## Execution Strategy
- 각 PABCD 사이클은 P(skip—plan은 이 MOC) → A(skip—mechanical rename) → B(실행) → C(verify) → D(close)
- Phase 2는 subagent 10개 병렬 (src 6 + test 4)
- Phase 4는 수동 정밀 작업 — main session이 직접
- 전체 예상 시간: ~1-2시간 (병렬 기준)
