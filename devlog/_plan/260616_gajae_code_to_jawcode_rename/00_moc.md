# @gajae-code → @jawcode Scope Rename

> Status: Plan draft
> Trigger: `npm install jawcode` 시 `@gajae-code/natives@1.0.0`을 npm에서 찾으려 함 → 404. upstream이 publish한 `0.4.4`만 존재. 자체 scope로 전환해야 dep 충돌 영구 해결.

## 규모

| 카테고리 | 파일 수 | 발생 수 | 비고 |
|---|---|---|---|
| **Live source** (packages/*, scripts/*, root) | **1,343** | **5,170** | 실제 바꿔야 할 곳 |
| devlog/_upstream_gjc/ | ~2,500 | ~수천 | 건드리지 않음 (upstream 스냅샷) |
| node_modules/ | 수백 | 수천 | 건드리지 않음 (bun install 재생성) |
| dist/ | 수십 | 수천 | 건드리지 않음 (bundle 재빌드) |

### 바꿔야 할 패키지 이름

| 현재 | 목표 | 위치 |
|---|---|---|
| `@gajae-code/utils` | `@jawcode/utils` | packages/utils |
| `@gajae-code/ai` | `@jawcode/ai` | packages/ai |
| `@gajae-code/natives` | `@jawcode/natives` | packages/natives |
| `@gajae-code/tui` | `@jawcode/tui` | packages/tui |
| `@gajae-code/stats` | `@jawcode/stats` | packages/stats |
| `@gajae-code/agent-core` | `@jawcode/agent-core` | packages/agent |
| `@gajae-code/coding-agent` | `@jawcode/coding-agent` | packages/coding-agent |
| `@gajae-code/bridge-client` | `@jawcode/bridge-client` | packages/bridge-client |
| `@gajae-code/typescript-edit-benchmark` | `@jawcode/typescript-edit-benchmark` | packages/typescript-edit-benchmark |
| `@gajae-code/orchestration-token-benchmark` | `@jawcode/orchestration-token-benchmark` | packages/orchestration-token-benchmark |
| `gajae-code` (root) | `jawcode-monorepo` (private) | root package.json |
| `gajae-code` (legacy package) | `@jawcode/legacy-cli` 또는 제거 | packages/gajae-code |

### 바꾸지 않는 것

| 항목 | 이유 |
|---|---|
| `devlog/_upstream_gjc/` | upstream 원본 스냅샷 — 비교 기준 유지 |
| `devlog/_reference/` | 참조 자료 |
| `struct_har/` 내 gjc_origin 파일 | 비교 하네스 (gjc_origin ↔ jwc_patched) |
| Rust crate `pi-natives` | npm scope와 무관, napi binding 이름. 별도 계획 |
| `ENGINE_NAME = "gjc"` (dirs.ts) | 파일시스템 경로에 사용 (~/.jwc/logs/gjc.YYYY-MM-DD.log). 호환성 유지 가능, 또는 별도 마이그레이션 |

## Phase 계획

### Phase 1: npm org + package.json names (선행 조건)

1. npm 웹에서 `@jawcode` org 생성
2. 모든 `packages/*/package.json`의 `"name"` 필드 변경
3. root `package.json` catalog의 `@gajae-code/*` → `@jawcode/*`
4. `packages/jwc/package.json` dependencies/devDependencies 변경
5. `packages/jwc/scripts/` bundle 명령의 `--external @gajae-code/natives` → `@jawcode/natives`
6. `bun install` 재실행 → `bun.lock` 재생성
7. 검증: `bun run check:ts` code 0

### Phase 2: source imports (ast_edit bulk rename — 병렬화 핵심)

`import ... from "@gajae-code/..."` → `import ... from "@jawcode/..."` 전체 치환.

**ast_edit 패턴:**
```
pat:  import { $$$IMPORTS } from "@gajae-code/$PKG"
out:  import { $$$IMPORTS } from "@jawcode/$PKG"
```

패키지별 8개 패턴:
- `@gajae-code/utils` → `@jawcode/utils`
- `@gajae-code/ai` → `@jawcode/ai`
- `@gajae-code/natives` → `@jawcode/natives`
- `@gajae-code/tui` → `@jawcode/tui`
- `@gajae-code/stats` → `@jawcode/stats`
- `@gajae-code/agent-core` → `@jawcode/agent-core`
- `@gajae-code/coding-agent` → `@jawcode/coding-agent`
- `@gajae-code/bridge-client` → `@jawcode/bridge-client`

+ `import type` 변형 + `from "@gajae-code/..."` 뒤에 `with { type: "json" }` 붙은 것도.
+ `export * from "@gajae-code/..."` 패턴도.

**ast_edit로 안 잡히는 것:**
- 문자열 리터럴 내 `"@gajae-code/"` (test fixtures, hardcoded references)
- 주석 내 참조
- `.md` 파일 내 참조

이것들은 `sed` 또는 text replace로 별도 처리.

**병렬 분할:**
| 서브에이전트 | 스코프 |
|---|---|
| A: packages/utils + packages/agent | import 변경 + package.json |
| B: packages/ai + packages/natives + packages/stats | import 변경 + package.json |
| C: packages/tui + packages/bridge-client | import 변경 + package.json |
| D: packages/coding-agent/src (절반: a-m) | import 변경 |
| E: packages/coding-agent/src (절반: n-z) + test | import 변경 |
| F: scripts/ + root configs | text replace |

### Phase 3: configs, CI, scripts

- `.github/workflows/*.yml` — `@gajae-code` 참조
- `scripts/rebrand-inventory.ts` — scope 검사 패턴
- `scripts/verify-g002-gates.ts` — scope 참조
- `scripts/check-public-legacy-zero.ts` — scope 참조
- `scripts/ci-release-publish.ts` — npm scope, package names
- `Cargo.toml` repository URL (minor)
- `Dockerfile`, `Dockerfile.robojwc` — 이미 대부분 jwc지만 검토

### Phase 4: tests, gates, fixtures

- `test/fixtures/harmony-leak-corpus.json` — `@gajae-code` 하드코딩
- `test/pi-scope-aliases.test.ts` — scope alias 테스트
- `test/default-jwc-definitions.test.ts` — definition 검증
- 모든 rebrand gates 재실행:
  - `bun scripts/check-visible-definitions.ts`
  - `bun scripts/verify-g002-gates.ts`
  - `bun scripts/rebrand-inventory.ts --strict`
  - `bun test packages/coding-agent/test/default-jwc-definitions.test.ts`

### Phase 5: verification

1. `bun install` — clean install
2. `bun run check:ts` — 전 패키지 code 0
3. `bun run ci:check:full` — lint + format + type check
4. `bun run ci:test:smoke` — smoke test pass
5. `jwc --version` — `jwc/1.0.2` (version bump)
6. Rebrand gates 전부 pass
7. `npm pack` → tarball 내 dep 확인 → `@jawcode/natives` 정상

## 리스크

| 리스크 | 완화 |
|---|---|
| `@jawcode` npm org가 이미 taken | npm 웹에서 확인 필요. 404면 생성 가능 |
| ast_edit가 모든 import 패턴 못 잡음 | text replace로 residual 처리 + grep 검증 |
| test fixture에 하드코딩된 scope | fixture 파일도 치환, fixture-generating script도 |
| Rust crate에서 `@gajae-code` 문자열 사용 | `pi-natives`는 npm scope와 무관. `scripts/build-native.ts`의 참조만 확인 |
| devlog 내 `@gajae-code` 참조 | 건드리지 않음. upstream 스냅샷이므로 원본 유지 |
| `ENGINE_NAME = "gjc"` → 로그 파일명 변경 시 기존 로그 못 읽음 | 이번에 안 바꿈. 별도 마이그레이션 계획 |

## 롤백

git branch로 관리. rename 전에 `pre-rename` tag 생성.
문제 시 `git reset --hard pre-rename` + `bun install`.

## 예상 규모

- **Phase 1**: ~15 파일 (package.json들)
- **Phase 2**: ~1,300 파일, ~5,000 occurrences (대부분 ast_edit로 자동)
- **Phase 3**: ~20 파일
- **Phase 4**: ~30 파일
- **Phase 5**: 검증만
- **총**: ~1,350 파일, ~5,100+ 변경
