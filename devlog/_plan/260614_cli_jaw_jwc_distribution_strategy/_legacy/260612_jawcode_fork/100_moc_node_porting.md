# 100 MOC — Node 포팅 베이스라인 (M2 진입)

> 상태: ✅ **완료 (260613)** — 100.01~100.12 전부 구현. Node 24에서 dist-node/sdk.js가
> createAgentSession을 로드하고 실 provider(openai-codex/gpt-5.5) 스트리밍 1턴 완주.
> 결정 근거: D8 [확정] — 상주 네이티브의 유일한 길. 구 03 §결정 1의 치환 매핑 승계.
> **260613 플립 기준 재구체화 (gjc→jwc flip 반영)** — 모든 코드 앵커를 플립 후 실측값으로 갱신.

---

## 배경 — 왜 이 밴드가 M2의 관문인가

M2의 최종 목표는 "cli-jaw 서버 프로세스 안에서 jwc 런타임이 상주(resident)하는 것"이다. 그 전제는 **Node 22 런타임이 `createAgentSession()`을 로드하고 스트리밍 왕복을 완주하는 것**이다. 현재 업스트림(`@gajae-code/*`)은 Bun 전용 raw `.ts` 배포이므로 이 밴드에서 Bun API를 Node 대응물로 교체하거나 런타임 감지 셰임을 주입해야 한다.

260612 gjc→jwc 소스 플립으로 패키지 내부 경로가 대거 바뀌었다:

| 구(gjc-era) | 신(jwc-era, 플립 후 실재) |
|-------------|--------------------------|
| `src/gjc-runtime/` | `src/jwc-runtime/` |
| `src/extensibility/gjc-plugins/` | `src/extensibility/jwc-plugins/` |
| `src/defaults/gjc/` + `gjc-defaults.ts` | `src/defaults/jwc/` + `jwc-defaults.ts` |
| `embedded:gjc/` 프리픽스 | `embedded:jwc/` 프리픽스 |
| `GjcRuntime*` 심볼 | `JwcRuntime*` 심볼 |
| receipt owner `gjc-state-cli / gjc-runtime / gjc-hook` | `jwc-state-cli / jwc-runtime / jwc-hook` (레거시 `gjc-*` 읽기 허용) |
| CLI 메시지 동사 `gjc …` | `jwc …` |
| 테스트 디렉터리 `test/gjc-runtime/` | `test/jwc-runtime/` |
| 픽스처 `test/fixtures/gjc-state` / `gjc-plugins` | `test/fixtures/jwc-state` / `jwc-plugins` |

**의도적으로 유지(Deferred)된 항목** — 100번대 포팅 작업이 건드려서는 안 된다:

| 항목 | 현재값 | 근거 |
|------|--------|------|
| `ENGINE_NAME` | `"gjc"` (`packages/utils/src/dirs.ts:20`) | 듀얼-브랜드 기계장치(isJawBrandEnv 분기)의 기준값 |
| `isJawBrand()` / `isJawBrandEnv()` | 그대로 유지 | `GJC_BRAND_NAME=jwc` env로 브랜드 토글 |
| `@gajae-code/*` 패키지 스코프 | 그대로 유지 | 업스트림 리베이스 친화, 변경 비용 과다 |
| env var STRING 값 `GJC_*` | `GJC_BRAND_NAME`, `GJC_*` 문자열 유지 | 062.1 §4 결정 |
| hindsight bank key `"gjc"` | 그대로 | 이력 누적 연속성 |
| coordinator MCP 이름 | 그대로 | 외부 계약 |
| tmux `@gjc-*` 옵션 | 그대로 | tmux 네이티브 레지스트리 |
| CI job/artifact 이름 | 그대로 | CI 계약 |
| bin `gjc` / `gjc-stats` | 그대로 (deferred) | 사용자 PATH 하위호환 |

---

## 코드 사실 (260613 플립 후 실측)

- 업스트림은 명시적 Bun 전용, 전 패키지 raw `.ts` 배포(빌드 산출물 없음)
- `check:node20-baseline` (`scripts/check-node20-baseline.ts`)은 "Node 지원 허위 주장 방지" 가드일 뿐 — 실제 Node 호환을 보장하지 않음
- `check:jwc-ui`는 `scripts/verify-jwc-ui-redesign.ts && scripts/rebrand-inventory.ts --strict` — 브랜드 어휘 리그레션 가드이므로 셰임 작업 후에도 반드시 green 유지
- Bun API 실측 사용처 (플립 후 현황 — 100.1 인벤토리 기준):
  - `packages/ai/src/`: 41개 사용 / 18개 파일
  - `packages/agent/src/`: 4개 파일 (`agent.ts`, `agent-loop.ts`, `harmony-leak.ts`, `compaction/openai.ts`)
  - `packages/coding-agent/src/` (비TUI 경로): 비TUI만 포팅 스코프
  - `packages/tui/`: **포팅 제외** — Bun 전용 7파일 (D8, TUI는 jwc CLI 전용이므로 Bun 유지)
- `packages/jwc/` 패키지 구조: `src/sdk.ts` (단일 재수출 `export * from "@gajae-code/coding-agent/sdk"`) — 이 단일 진입점이 cli-jaw 임베딩의 계약 표면

---

## Bun API 치환 매핑 (100.1 인벤토리 기반 갱신)

아래 표는 [100.1 상세 인벤토리](./phase1/100.1_plan_bun_shim_inventory.md)의 요약이다. 구현 시 반드시 100.1 §2를 정본으로 참조한다.

| # | Bun API | 합계(비TUI src) | Node 22 대응 | 방법 | 핵심 파일 앵커 |
|---|---------|----------------|-------------|------|--------------|
| A | `Bun.file` / `.text()` / `.json()` / `.exists()` / `.stat()` / `.bytes()` | 173 | `node:fs/promises` | 셰임 (런타임 분기) | `coding-agent/src/extensibility/plugins/manager.ts` · `src/tools/read.ts` |
| B | `Bun.write` | 83 | `fs.writeFile` | 셰임 (런타임 분기) | `src/tools/write.ts` |
| C | `Bun.spawn` | 38 | `node:child_process` | 셰임 (런타임 분기) | `src/stt/recorder.ts` (pty 경로 별도 검토) |
| D | `bun:sqlite` | 17 | `better-sqlite3` (cli-jaw 기보유) | 셰임 (런타임 분기) | `ai/src/auth-storage.ts:10` · `coding-agent/src/memories/storage.ts:1` |
| E | `Bun.sleep` | 49 | `timers/promises` `setTimeout` | 셰임 (런타임 분기) | **`coding-agent/src/sdk.ts:1064`** (`STARTUP_SCAN_DEADLINE_MS`) · `src/system-prompt.ts:458` |
| F | `Bun.hash` / `Bun.CryptoHasher` / `Bun.SHA256` | 37 | `node:crypto` / `xxhash-wasm` | 셰임 (런타임 분기) | `ai/src/utils.ts:51,73,84` · `ai/src/auth-storage.ts:979` · `coding-agent/src/session/blob-store.ts:29,49,110` |
| G | `import x with { type: "text" }` (텍스트 임베드) | 158 | esbuild `loader: {'.md':'text','.html':'text'}` | **빌드 치환(esbuild)** | `coding-agent/src/system-prompt.ts:14–16` · `agent/src/compaction/compaction.ts:30–35` · **`src/defaults/jwc-defaults.ts`** (플립 후 `embedded:jwc/` 프리픽스) |
| H | `Bun.JSONL.parseChunk` | 3 | 자체 구현 | 재작성 필요 | **`packages/utils/src/stream.ts:15,20`** (`parseChunk` 시그니처 보존) |
| I | `Bun.JSON5.parse` | 3 | `json5` npm | 셰임 (런타임 분기) | `coding-agent/src/tools/write.ts:407` |
| J | `Bun.serve` | 7 | `node:http` 래퍼 | 재작성 필요 | `ai/src/utils/oauth/callback-server.ts:151` · `ai/src/auth-broker/server.ts:515` (M2 엔진 포팅 주변부) |
| K | `Bun.stdin` / `.stdout` / `.stderr` | 5 | `process.stdin/stdout/stderr` | 셰임 (런타임 분기) | `coding-agent/src/modes/rpc/rpc-mode.ts:509` · `src/hooks/native-skill-hook.ts:243` |
| L | `Bun.stripANSI` | 2 | `strip-ansi` npm | 셰임 (런타임 분기) | `utils/src/sanitize-text.ts:35` |
| M | `Bun.semver` | 3 | **제거** (Node 빌드 진입점에서 무의미) | 빌드 치환 (조건 제거) | **`coding-agent/src/cli.ts:27`** — `if (Bun.semver.order(...) < 0)` |
| N | `Bun.env.X` | 64 | `process.env.X` | esbuild `define: {'Bun.env':'process.env'}` | `coding-agent/src/main.ts:795,804` |
| O | `Bun.Archive` | 9 | `node-tar` (tar) + `fflate` (zip, 기보유) | 재작성 필요 | `src/tools/archive-reader.ts:129` · `src/tools/write.ts:307` |
| P | `Bun.gc` | 1 | no-op | 셰임 (런타임 분기) | `src/debug/profiler.ts` 1곳 |
| R | `bun:test` | (테스트 전용) | `vitest` | 빌드 치환 (테스트 전용) | 815 import 줄 → vitest 동일 API 직치환 |

> **셰임 위치 확정 (플립 후)**: `packages/jwc/src/shims/` — 아직 비존재 (`ls packages/jwc/src/` = `cli-entry.ts index.ts sdk.ts` 3파일). 이 밴드에서 신규 생성.

---

## 스코프 (구현 대상 3계층)

### 계층 1 — 셰임 레이어 (기본값)

`packages/jwc/src/shims/` 아래에 런타임 감지 래퍼를 작성한다.

```
packages/jwc/src/shims/
  bun-file.ts      # A, B — fs/promises 래퍼
  bun-spawn.ts     # C — child_process 래퍼
  bun-sqlite.ts    # D — better-sqlite3 팩토리
  bun-sleep.ts     # E — timers/promises setTimeout
  bun-hash.ts      # F — xxhash-wasm / node:crypto 선택
  bun-serve.ts     # J — node:http 래퍼 (M2 스코프 내 3곳)
  bun-stdio.ts     # K — process.stdin/stdout/stderr
  bun-misc.ts      # I (json5), L (strip-ansi), O (node-tar), P (gc no-op)
  index.ts         # re-export 통합
```

- Bun 실행 시: 네이티브 Bun API 그대로 통과 (`globalThis.Bun` 감지)
- Node 실행 시: 대응 npm/node 구현으로 라우팅
- 업스트림 파일 수정은 `import` 경로 치환 최소 diff (리베이스 친화)

### 계층 2 — 트랜스파일 빌드

esbuild로 `packages/{ai,agent,coding-agent}` 비TUI 경로 → `packages/jwc/dist-node/` (현재 미존재, 이 밴드에서 신설):

```
packages/jwc/dist-node/
  index.js         # createAgentSession 등 공개 표면
  sdk.js           # cli-jaw 임베딩 진입점
```

- esbuild 설정 핵심:
  - `target: 'node22'`
  - `loader: { '.md': 'text', '.html': 'text' }` — G항목 158곳 일괄 처리
  - `define: { 'Bun.env': 'process.env' }` — N항목 64곳 일괄 처리
  - `external: ['better-sqlite3', 'node-tar', 'strip-ansi', 'json5', 'xxhash-wasm']` — 설치 의존성
- tsc는 타입체크 전용 (`noEmit: true`)

### 계층 3 — 테스트 베이스라인

Node 22 러너(vitest 또는 `node:test`)로 업스트림 핵심 테스트 통과:

| 테스트 파일 | 의미 | 비고 |
|-------------|------|------|
| `packages/utils/src/stream.test.ts` (1,662줄) | H항목 `Bun.JSONL.parseChunk` 핵심 | 자체 파서 검증 기준 |
| `packages/coding-agent/test/jwc-runtime/` | 플립 후 신설 디렉터리 — 실재 확인 ✅ | receipt owner `jwc-*` 검증 포함 |
| `packages/coding-agent/test/jwc-plugin-*.test.ts` | `src/extensibility/jwc-plugins/` 통합 | 플립 후 실재 확인 ✅ |
| agent/ai 핵심 스트리밍 테스트 | createAgentSession 경로 | 실 프로바이더 1개 스트리밍 포함 |

---

## 구현 페이즈 (파일 레벨 앵커)

### Phase A — 준비 (착수 전 체크)

| 항목 | 확인 방법 | 통과 기준 |
|------|----------|-----------|
| `bun run check:ts` green | CI 동등 | 0 에러 |
| `check:jwc-ui` green | `scripts/verify-jwc-ui-redesign.ts` + `rebrand-inventory.ts --strict` | 0 위반 |
| `ENGINE_NAME="gjc"` 보존 | `packages/utils/src/dirs.ts:20` grep | `"gjc"` 문자열 유지 |
| `packages/jwc/src/` 파일 수 확인 | `ls packages/jwc/src/` | `cli-entry.ts index.ts sdk.ts` (shims 미존재가 정상) |
| 100.1 인벤토리 최신화 | `phase1/100.1_plan_bun_shim_inventory.md` 참조 | Bun.sleep 잔존 등 드리프트 재실측 후 표 업데이트 |

### Phase B — 셰임 레이어 구현

1. `packages/jwc/src/shims/` 디렉터리 신설
2. A, B, C, E, N 항목 — 빈도 높은 파일·읽기 경로부터 (`sdk.ts:1064`, `system-prompt.ts:458`, `tools/read.ts`, `tools/write.ts`)
3. D 항목 — `better-sqlite3` 팩토리: `ai/src/auth-storage.ts`, `memories/storage.ts` 2곳
4. F 항목 — `bun-hash.ts`: `ai/src/utils.ts`, `blob-store.ts`, `auth-storage.ts` 해시 경로
5. H 항목 — `utils/src/stream.ts` 자체 파서 작성 (시그니처 `parseChunk(input, start?, stop?)` 보존)
6. G 항목 — `jwc-defaults.ts`의 `import … with { type: "text" }` (플립 후 `embedded:jwc/` 프리픽스 경로) 는 esbuild 빌드 설정으로 처리 — 런타임 코드 무수정
7. M 항목 — `coding-agent/src/cli.ts:27`의 `Bun.semver` 블록: Node 빌드 진입점 분리 또는 `process.isBun` 조건부 wrap

**게이트 (Phase B 완료 후):** `bun test packages/utils` + `bun test packages/ai` green (기존 Bun 경로 무회귀)

### Phase C — esbuild 빌드 파이프라인

1. `packages/jwc/scripts/build-node.ts` (또는 `Bun.build` 호출) 신설
2. `packages/jwc/package.json`에 `"build:node"` 스크립트 추가
3. `dist-node/` 산출물 확인: `node packages/jwc/dist-node/sdk.js` import 가능

**게이트 (Phase C 완료 후):** `node -e "import('./packages/jwc/dist-node/sdk.js').then(m => console.log(Object.keys(m)))"` — `createAgentSession` 포함

### Phase D — Node 테스트 베이스라인

1. vitest 설치 (`devDependencies`, 글로벌 설치 아님)
2. `packages/utils/src/stream.test.ts` vitest 실행 — `Bun.JSONL` 자체 파서 검증
3. `packages/coding-agent/test/jwc-runtime/` 테스트군 Node 22 실행
4. 실 프로바이더 1개(Claude 또는 OpenAI) 스트리밍 헬로월드 수기 검증

**게이트 (Phase D 완료 후):** Node 22 통과 테스트 목록을 본 문서 §완료 기준에 append

### 세부 실행 문서 순서

| 단계 | 문서 | 목적 |
|------|------|------|
| 100.00 | [100.00_prep_gate_cleanup.md](./100.00_prep_gate_cleanup.md) | Phase A 준비 게이트 정리 완료 |
| 100.01 | [100.01_plan_node_porting_entrypoint.md](./100.01_plan_node_porting_entrypoint.md) | `packages/jwc/dist-node/sdk.js` 빌드 계약 고정 |
| 100.02 | [100.02_plan_bun_global_shim_injection.md](./100.02_plan_bun_global_shim_injection.md) | `globalThis.Bun` 셰임 주입 골격 |
| 100.03 | [100.03_plan_file_sleep_env_shims.md](./100.03_plan_file_sleep_env_shims.md) | file/write/sleep/stdio/env 고빈도 API |
| 100.04 | [100.04_plan_spawn_process_shim.md](./100.04_plan_spawn_process_shim.md) | subprocess / `Bun.spawn` 호환 |
| 100.05 | [100.05_plan_data_core_adapters.md](./100.05_plan_data_core_adapters.md) | sqlite/hash/jsonl/json5/ansi 핵심 데이터 API |
| 100.06 | [100.06_plan_text_embed_bundle_validation.md](./100.06_plan_text_embed_bundle_validation.md) | `.md`/`.html` 텍스트 임베드 번들 검증 |
| 100.07 | [100.07_plan_peripheral_runtime_apis.md](./100.07_plan_peripheral_runtime_apis.md) | serve/archive/gc/semver 주변 API |
| 100.08 | [100.08_plan_node_sdk_import_smoke.md](./100.08_plan_node_sdk_import_smoke.md) | Node 22 SDK import + `createAgentSession` export 확인 |
| 100.09 | [100.09_plan_create_agent_session_smoke.md](./100.09_plan_create_agent_session_smoke.md) | Node 22 세션 생성/cleanup smoke |
| 100.10 | [100.10_plan_mock_streaming_loop.md](./100.10_plan_mock_streaming_loop.md) | mock provider 스트리밍 루프 |
| 100.11 | [100.11_plan_real_provider_hello_world.md](./100.11_plan_real_provider_hello_world.md) | 실 provider 스트리밍 hello world |
| 100.12 | [100.12_plan_node_porting_closeout.md](./100.12_plan_node_porting_closeout.md) | 100 밴드 완료 판정 + 110 handoff |

---

## 완료 기준

- ✅ `node packages/jwc/dist-node/sdk.js`에서 `createAgentSession()` 로드 및 실 프로바이더 1개 스트리밍 완주
- Node 24.14 통과 검증 (260613):

  | 검증 | 결과 | 재현 | 커밋 |
  |------|------|------|------|
  | 데이터코어 셰임 동등성 (JSONL/hash/SHA256) | 9 pass (bun:test, 네이티브 직대조) | `bun test packages/jwc/test/shims-data-core.test.ts` | d7b7099d |
  | bun:sqlite 어댑터 표면 (better-sqlite3) | OK | `node scripts/test-node-shims.mjs` | d7b7099d |
  | SDK import (100.08) | 25 exports·createAgentSession | `node scripts/smoke-node-sdk.mjs` | 8fa5ee46 |
  | 세션 생성+dispose (100.09) | OK | (동상) | 8fa5ee46 |
  | mock 스트리밍 1턴 (100.10) | 7-event 라이프사이클·텍스트 왕복 | `node scripts/smoke-node-streaming.mjs` | e08284c2 |
  | **실 provider 스트리밍 (100.11)** | **openai-codex/gpt-5.5, 4 deltas, "Hello!", exit 0** | `node scripts/smoke-node-real-provider.mjs` | e08284c2 |

- ✅ **Bun 경로 무회귀**: `check:jwc-ui` green, jwc 데이터코어 셰임 bun:test green, shims/index는
  `!globalThis.Bun`일 때만 설치(네이티브 Bun 무손상), 빌드 alias/define은 build-node.ts에만 존재.
- ✅ `check:jwc-ui` green (브랜드 어휘 리그레션 0 — dist-node 스캐너 제외 처리)
- ✅ `packages/jwc/dist-node/sdk.js` 생성 (23.7MB ESM, gitignored)
- ⚠ `check:ts` 전역은 **다른 세션의 미커밋 변경**(sdk.ts·builtin-registry.ts 등 13 biome 포맷)으로
  red — 100 밴드 산출물(packages/jwc, natives 패치)은 biome·tsc 클린. 해당 포맷은 소유 세션이 정리.

---

## 리스크 테이블

| # | 리스크 | 가능성 | 영향 | 대응 |
|---|--------|--------|------|------|
| R1 | `import … with { type: "text" }` G항목 — esbuild 버전에 따라 `with` assertion 미지원 | 중 | 높음 | esbuild ≥0.24 확인; 구 문법 `assert { type: "text" }` fallback |
| R2 | `Bun.JSONL.parseChunk` 자체 파서 — `stream.test.ts` 1,662줄 엣지케이스 | 중 | 높음 | 파서를 `utils/src/stream.ts` 내부화 + `parseChunk` 시그니처 그대로 — bun test로 우선 green 확인 |
| R3 | `bun:sqlite`→`better-sqlite3` API 차이 — sync API는 일치하나 `Statement` 제네릭 타입 | 낮 | 중 | D항목 2파일만 교체, 타입 어시션으로 흡수 가능 |
| R4 | `Bun.spawn` ↔ `node:child_process` stdin/stdout 파이프 옵션 불일치 | 중 | 중 | C항목 38곳 중 pty 경로(`stt/recorder.ts`) 별도 처리 — M2 스코프에서 STT는 TUI 전용이므로 Node 빌드에서 제외 가능 |
| R5 | 업스트림 리베이스 시 셰임 충돌 | 중 | 중 | 셰임은 `packages/jwc/src/shims/`에만 존재, 업스트림 파일 최소 diff 정책 (000 리베이스 정책 위임) |
| R6 | `ENGINE_NAME="gjc"` 보존 실수 — Node 빌드 시 esbuild define이 오염할 가능성 | 낮 | 높음 | `define` 키에 `ENGINE_NAME` 절대 추가 금지; `Bun.env`만 대상 |
| R7 | `better-sqlite3` native addon — cli-jaw Node 버전과 ABI 불일치 | 중 | 높음 | cli-jaw가 기보유한 `better-sqlite3` 버전과 동일 버전 사용 (`000_roadmap.md` §전제 체크리스트 참조) |

---

## 이별 결정 반영 — ralplan 스킬 semantic-follow only

260612 결정: **ralplan 스킬은 superseded**. `src/defaults/jwc/skills/ralplan/SKILL.md`에 `source: "... superseded by native orchestrate (99.30.02 이별)"` 기입 완료. 이 밴드에서 ralplan 관련 코드(`jwc-runtime/ralplan-runtime.ts`)는 Node 포팅 대상에 포함되지만, 새 구현을 투자해 확장하지 않는다. `jwc orchestrate p --spec-ref` (native orchestrate plan stage)가 정본이며, ralplan은 구형 호출만 수신(semantic-follow) 한다.

---

## 열린 질문 [확정 대기]

| ID | 질문 | 관련 파일 | 해소 경로 |
|----|------|----------|-----------|
| Q1 | `packages/jwc/dist-node/` 경로 vs `packages/coding-agent/dist-node/` — 어느 패키지에 산출물을 두는가? | `packages/jwc/package.json` | 98 §1 전제 체크리스트에서 합의 경로 확정 필요 |
| Q2 | vitest vs `node:test` 러너 선택 — 기존 bun:test API와의 호환성 고려 | `bun:test` 815 줄 | vitest가 describe/it/expect 동일 API라 직치환 유리; 최종 선택 [확정 대기] |
| Q3 | `Bun.serve` J항목 — auth-broker/gateway 서버는 cli-jaw 측 Node 코드라 포팅 스코프 밖이 맞는가? `coding-agent/src/bridge-mode.ts:616`은 스코프 안인지 확인 필요 | 100.1 §J | 착수 전 grep 재실측 |
| Q4 | 듀얼 런타임 유지비 vs Node 단일화 | — | [기본값] 듀얼 (TUI가 Bun이므로) — 변경 시 사용자 결정 필요 |
| Q5 | 99 밴드 결정 7 "Code 모드(ACP) 선행" — 100번대 착수 전 Code 모드(ACP) prototype([112.1](./phase1/112.1_plan_code_mode_acp_prototype.md))이 선행해야 하는가? | `000_roadmap.md` §M2 착수 전 체크 | 99.00.00 §결정7 확인 후 순서 확정 [확정 대기] |

---

## 상위 문서 / 관련 문서

| 문서 | 역할 |
|------|------|
| [phase1/000_roadmap.md](./phase1/000_roadmap.md) | 밴드 위치, M2 착수 전 99 선반영 체크리스트 |
| [100.00_prep_gate_cleanup.md](./100.00_prep_gate_cleanup.md) | Phase A 준비 게이트 정리 완료 기록 |
| [100.01_plan_node_porting_entrypoint.md](./100.01_plan_node_porting_entrypoint.md) | 다음 착수점: `packages/jwc/dist-node/` 빌드 스켈레톤 |
| [100.02_plan_bun_global_shim_injection.md](./100.02_plan_bun_global_shim_injection.md) ~ [100.12_plan_node_porting_closeout.md](./100.12_plan_node_porting_closeout.md) | Node 포팅 세부 실행 문서 전체 |
| [phase1/100.1_plan_bun_shim_inventory.md](./phase1/100.1_plan_bun_shim_inventory.md) | Bun API 전수 인벤토리 정본 (실측값, 파일:라인 앵커 포함) |
| [phase1/098_plan_m2_post100_execution.md](./phase1/098_plan_m2_post100_execution.md) | 100 완료 후 110→150 실행 계획, 100 산출물 전제 체크리스트 |
| [111_design_runtime_attach.md](./111_design_runtime_attach.md) | M1→M2 드리프트 6항목, JawRuntime 설계 |
| [phase1/03_roadmap_phases.md](./phase1/03_roadmap_phases.md) | D8 결정 원문 ("상주 네이티브의 유일한 길") |
