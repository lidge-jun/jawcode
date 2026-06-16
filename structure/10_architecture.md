# Jawcode 아키텍처 (현재 형태)

> 2026-06-14 기준. gajae-code 0.4.4 lineage, public repo root commit `7e51e5e2`.
> **현재 코드 형태** 기록. 로드맵·밴드: `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/`. 계보: [fork-delta.md](./40_fork-delta.md).

## 1. 정체

Jawcode는 gajae-code 계열 코드베이스에서 출발한 JWC 모노레포이며 공개 실행 표면은 `jwc`다. 엔진은 Bun 런타임 기반의
Claude Code급 풀 코딩 에이전트로, 프로바이더 계층부터 TUI까지 전부 자체 구현돼 있다.

- 런타임: **Bun 1.3.14** (workspaces + catalog)
- 린트/포맷: biome
- 네이티브: `crates/` (Rust, napi-rs → `@gajae-code/natives`), `python/robogjc` (web)

## 2. 패키지 맵

```
packages/
  ai/              @gajae-code/ai          — 44+ 프로바이더 스트리밍 계층 (stream.ts 디스패처)
  agent/           @gajae-code/agent-core  — 에이전트 루프, 상태, 컴팩션, transport 추상화
  coding-agent/    @gajae-code/coding-agent — JWC CLI/runtime 본체 (도구, 세션, 스킬, 슬래시커맨드, 모드)
  tui/             @gajae-code/tui         — 차등 렌더링 TUI 라이브러리
  utils/           @gajae-code/utils       — 공용 유틸
  stats/           @gajae-code/stats       — 사용량/통계
  natives/         @gajae-code/natives     — Rust napi 바인딩
  bridge-client/   @gajae-code/bridge-client — 원격 브리지
  jwc/             jawcode                 — jaw 표면 (npm: jawcode, bin: jwc, export: ./sdk)
```

전체 package/crate 표는 [architecture.md](./10_architecture.md)가 정본이다.

| 핵심 패키지 | 현재 역할 | 근거 |
|---|---|---|
| `packages/jwc` | `jawcode` npm package + `jwc` bin + `jawcode/sdk` public boundary wrapper | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/package.json:1`, `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/src/sdk.ts:1` |
| `packages/coding-agent` | 실제 CLI/runtime/SDK 구현 | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:796` |
| `packages/agent` | agent loop/core abstraction | `/Users/jun/Developer/new/700_projects/jawcode/packages/agent/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/agent/package.json:5` |
| `packages/ai` | provider/model/auth layer | `/Users/jun/Developer/new/700_projects/jawcode/packages/ai/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/ai/package.json:5` |
| `packages/natives` | Rust N-API native binding | `/Users/jun/Developer/new/700_projects/jawcode/packages/natives/package.json:2`, `/Users/jun/Developer/new/700_projects/jawcode/packages/natives/package.json:50` |

## 3. 핵심 시임 (cli-jaw 통합 관점)

### 3.1 `packages/jwc/src/sdk.ts` → `packages/coding-agent/src/sdk.ts` — 프로그래매틱 임베딩 (★ 최중요)

`createAgentSession(options)` 가 CLI 없이 에이전트 세션을 코드로 생성한다.
부속 API: `discoverSkills()`, `discoverSlashCommands()`, `discoverPromptTemplates()`,
`buildSystemPrompt()`, `discoverAuthStorage()`, `discoverExtensions()`.
→ cli-jaw 서버가 jawcode를 **in-process로 품는 공식 통로**.

| 표면 | 현재 사실 | 근거 |
|---|---|---|
| `jawcode/sdk` | coding-agent SDK를 재수출한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/package.json:18`, `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/src/sdk.ts:1` |
| `createAgentSession()` | `CreateAgentSessionOptions`를 받아 `AgentSession`을 만든다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:217`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:796` |
| system prompt override | `options.systemPrompt`는 array 또는 default prompt transformer function이다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:240`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1613` |
| auth injection | `options.authStorage`와 `discoverAuthStorage()`가 credential bridge 지점이다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:225`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:409` |

### 3.2 `packages/coding-agent/src/modes/` — 실행 모드

- `interactive-mode.ts` — TUI 대화 모드 (기본); 마운트 순서(260613 갱신): chatContainer → ViewportFill(센티널) → liveToolContainer(라이브 존, B2-lite §11) → composerContainer. 도구는 실행 중 liveToolContainer에서 preview하고 완료 시 접힌 1줄로 chatContainer에 커밋(tool.renderMode=commit 브랜드 기본).
- `print-mode.ts` — 단발 실행
- `rpc/` — JSONL RPC 모드 (cli-jaw pi-runtime과 동일 패턴의 사이드카 통로)
- `acp/` — Agent Client Protocol
- `bridge/` — 원격 브리지

### 3.3 `packages/agent/src/agent-loop.ts` — 에이전트 루프

`@gajae-code/ai`의 `streamSimple()` 위에서 tool call → 실행 → 피드백 루프.
`AppendOnlyContextManager`, 컴팩션(`compaction/`), thinking 제어 포함.

### 3.4 확장 표면 (스킬/슬래시커맨드/도구)

- `src/extensibility/skills.ts` — SKILL.md 디스커버리 (cli-jaw 전역 스킬과 같은 포맷 계열)
- `src/extensibility/slash-commands.ts` + `src/slash-commands/` — 슬래시커맨드 레지스트리
- `src/extensibility/custom-tools/` — 커스텀 도구 주입
- `src/tools/` — read/bash/edit/write/grep/browser/ast-edit 등 내장 도구
- 공개 워크플로 4종: `jaw-interview` / `plan`(`jwc orchestrate`) / `goal`(`jwc goal`) / `team` (JWC runtime 표준). 내부 소스 경로는 이행기 동안 `ralplan`·`ultragoal` 엔진명을 보존한다.
- `src/gjc-runtime/memory-runtime.ts` + `src/commands/memory.ts`·`chat.ts` — `jwc memory`/`jwc chat` CLI verbs 네이티브 구현 (99.01 완료, 260613); local-query/memory-fts 배관 포함. 세부: [session_storage.md](./22_session_storage.md).

세부 표는 [extensibility.md](./21_extensibility.md)와 [extensibility.md](./21_extensibility.md)가 정본이다.

### 3.5 세션/상태

- `src/session/` — 세션 영속화 (agent db)
- `.jwc/` — 런타임 상태, 플랜, 스펙, 원장 (jwc 런타임 표준 경로)

세부 storage 표는 [session_storage.md](./22_session_storage.md)가 정본이다.

## 4. cli-jaw 쪽 대응 시임 (참조)

| cli-jaw | 역할 | jawcode 대응 |
|---------|------|--------------|
| `src/agent/spawn.ts` `spawnAgent()` | 런타임 디스패치, `{child, promise}` 계약 | in-process 어댑터가 `child:null`로 반환 |
| `src/prompt/builder.ts` | 전역 스킬(`~/.cli-jaw/skills`) 시스템 프롬프트 주입 | `buildSystemPrompt()`/`discoverSkills()`와 브리지 |
| `src/orchestrator/state-machine.ts` | PABCD 단계 프롬프트 | 동일 프롬프트를 세션에 주입 (장기: 코드 레벨 게이팅) |
| `src/core/bus.ts` | 이벤트 브로드캐스트 | AgentEvent → bus 매핑 |
| `jaw.db` | 세션/메시지 영속화 | 네이티브 세션 저장 → spawn/resume 로직 불요 |

## 5. 미해결 결정 (devlog에서 추적)

1. **호스팅 방식**: Node 포팅(`Bun.*` 치환) vs cli-jaw를 Bun으로 vs Bun 사이드카(rpc 모드).
   `Bun.*` 사용처: ai 계층 ~20지점, agent 4파일, tui 7파일 (tui는 TUI 바이너리에만 필요).
2. **스킬 단일화**: cli-jaw 전역 스킬 vs jwc `.jwc` 디스커버리 — 어느 쪽으로 수렴할지.
3. **세션 소유권**: jaw.db vs jwc agent db.

## 6. M1/M2 로드맵 연결

| 마일스톤 | 코드상 접점 | 근거 |
|---|---|---|
| M1 010–019 jwc 셸 + 공개 표면 | `packages/jwc/bin/jwc.js`, `packages/jwc/package.json` | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/000_roadmap.md:13`, `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/bin/jwc.js:1` |
| M1 020–029 프롬프팅 개편 | `packages/coding-agent/src/system-prompt.ts`, `prompts/system/system-prompt.md` | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/000_roadmap.md:14`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/system-prompt.ts:372` |
| M1 030–039 스킬 디스커버리 3계층 | `extensibility/skills.ts`, `discovery/builtin.ts` | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/000_roadmap.md:15`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:105` |
| M2 110–119 JawRuntime 상주 서비스 | `createAgentSession()` + event bus + session manager | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/000_roadmap.md:25`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:796` |
| M2 120–129 jaw.db 영속화 | `SessionManager` override와 cli-jaw adapter | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/000_roadmap.md:26`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:311` |


---

# (merged) Packages / Crates 지도


---

## Packages / Crates Overview

> jawcode는 Bun monorepo + Rust crates 구조다. 공개 CLI는 `jwc`이고, 현재 런타임 본체는 `@gajae-code/coding-agent`에 있다.

### 의존 방향

```text
jwc CLI/package
  -> @gajae-code/coding-agent
       -> @gajae-code/agent-core
       -> @gajae-code/ai
       -> @gajae-code/tui
       -> @gajae-code/natives
       -> @gajae-code/utils
       -> @gajae-code/stats
@gajae-code/natives
  -> crates/pi-natives
       -> crates/pi-ast
       -> crates/pi-iso
       -> crates/pi-shell
            -> crates/brush-*-vendored
```

### `packages/*`

| 패키지 | 역할 | 핵심 진입 파일/표면 | 의존 방향 | 근거 |
|---|---|---|---|---|
| `packages/jwc` | `jawcode` 공개 npm 패키지. `jwc` Node launcher가 managed Bun runtime으로 bundle/workspace CLI를 실행하고 `jawcode/sdk`를 제공한다. | `bin/jwc.js`, `src/sdk.ts`, `src/index.ts`, `dist-node/sdk.js` | `@gajae-code/coding-agent` + package-local `bun` runtime dependency | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/bin/jwc.js:1`, `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/src/sdk.ts:1` |
| `packages/coding-agent` | jwc CLI 본체. 도구, 세션, 스킬, 슬래시커맨드, prompt, mode, workflow runtime이 있다. | `src/cli.ts`, `src/sdk.ts`, `src/main.ts` | `agent-core`, `ai`, `natives`, `tui`, `utils`, `stats` | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/package.json:30`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/package.json:49` |
| `packages/agent` | provider-agnostic agent loop/core. transport/state/attachment abstraction. | `src/index.ts` export | `ai`, `natives`, `utils` | `/Users/jun/Developer/new/700_projects/jawcode/packages/agent/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/agent/package.json:27`, `/Users/jun/Developer/new/700_projects/jawcode/packages/agent/package.json:37` |
| `packages/ai` | provider/model registry, stream, auth broker/gateway, OAuth/API key 계층. | `src/index.ts`, `src/cli.ts`(`pi-ai`) | `utils`, OpenAI/Anthropic SDK 등 외부 provider deps | `/Users/jun/Developer/new/700_projects/jawcode/packages/ai/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/ai/package.json:31`, `/Users/jun/Developer/new/700_projects/jawcode/packages/ai/package.json:43` |
| `packages/tui` | differential rendering 기반 terminal UI library. | `src/index.ts`, `src/components/*` exports | `natives`, `utils` | `/Users/jun/Developer/new/700_projects/jawcode/packages/tui/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/tui/package.json:40`, `/Users/jun/Developer/new/700_projects/jawcode/packages/tui/package.json:58` |
| `packages/natives` | Rust N-API binding package. grep/clipboard/image/PTY/shell/syntax highlighting. | `native/index.js`, `native/index.d.ts` | Rust `crates/pi-natives` 빌드 산출물 | `/Users/jun/Developer/new/700_projects/jawcode/packages/natives/package.json:2`, `/Users/jun/Developer/new/700_projects/jawcode/packages/natives/package.json:29`, `/Users/jun/Developer/new/700_projects/jawcode/packages/natives/package.json:50` |
| `packages/utils` | 경로, config dir, logger, prompt/render helper 등 공용 유틸. | `src/index.ts` | `natives`, handlebars, winston | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/package.json:23`, `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/package.json:33` |
| `packages/stats` | local observability dashboard. | `src/index.ts`, `gjc-stats` legacy package bin | `ai`, `utils`, React/Tailwind/Chart deps | `/Users/jun/Developer/new/700_projects/jawcode/packages/stats/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/stats/package.json:27`, `/Users/jun/Developer/new/700_projects/jawcode/packages/stats/package.json:39` |
| `packages/bridge-client` | jwc backend bridge protocol TypeScript client SDK. | `src/index.ts` | 독립 TS SDK | `/Users/jun/Developer/new/700_projects/jawcode/packages/bridge-client/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/bridge-client/package.json:22`, `/Users/jun/Developer/new/700_projects/jawcode/packages/bridge-client/package.json:41` |
| `packages/gajae-code` | REMOVED legacy shell wrapper. repo 내 공개 진입은 `packages/jwc` 하나다. | — | — | `structure/40_fork-delta.md:28` |
| `packages/orchestration-token-benchmark` | orchestration token efficiency internal benchmark. live model call 없는 deterministic benchmark가 기본이다. | `src/index.ts`, `src/live-runner.ts` | private package | `/Users/jun/Developer/new/700_projects/jawcode/packages/orchestration-token-benchmark/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/orchestration-token-benchmark/package.json:6`, `/Users/jun/Developer/new/700_projects/jawcode/packages/orchestration-token-benchmark/package.json:22` |
| `packages/typescript-edit-benchmark` | TypeScript edit mutation benchmark. | `src/index.ts`, `typescript-edit-benchmark` bin | `coding-agent`, `agent-core`, `ai`, `tui`, AST deps | `/Users/jun/Developer/new/700_projects/jawcode/packages/typescript-edit-benchmark/package.json:3`, `/Users/jun/Developer/new/700_projects/jawcode/packages/typescript-edit-benchmark/package.json:15`, `/Users/jun/Developer/new/700_projects/jawcode/packages/typescript-edit-benchmark/package.json:28` |

### `crates/*`

| crate | 역할 | 핵심 surface | 근거 |
|---|---|---|---|
| `crates/pi-natives` | N-API `cdylib`; TS native package로 연결되는 Rust entry. | `crate-type = ["cdylib"]`, `napi`, `napi-derive` | `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-natives/Cargo.toml:1`, `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-natives/Cargo.toml:9`, `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-natives/Cargo.toml:31` |
| `crates/pi-ast` | tree-sitter/ast-grep 기반 AST parsing helper. | 다수 tree-sitter grammar dependencies | `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast/Cargo.toml:1`, `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast/Cargo.toml:12`, `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast/Cargo.toml:69` |
| `crates/pi-iso` | OS isolation/portable helper 계층. | `tokio`, `similar`, platform deps | `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-iso/Cargo.toml:1`, `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-iso/Cargo.toml:12`, `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-iso/Cargo.toml:17` |
| `crates/pi-shell` | shell execution helper. brush vendored crates를 사용한다. | `brush-builtins`, `brush-core`, `brush-parser` | `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-shell/Cargo.toml:1`, `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-shell/Cargo.toml:12`, `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-shell/Cargo.toml:15` |
| `crates/brush-builtins-vendored` | vendored POSIX/bash shell builtins. | upstream brush package metadata | `/Users/jun/Developer/new/700_projects/jawcode/crates/brush-builtins-vendored/Cargo.toml:1`, `/Users/jun/Developer/new/700_projects/jawcode/crates/brush-builtins-vendored/Cargo.toml:12`, `/Users/jun/Developer/new/700_projects/jawcode/crates/brush-builtins-vendored/Cargo.toml:23` |
| `crates/brush-core-vendored` | vendored reusable POSIX/bash shell core. | `brush_core` lib | `/Users/jun/Developer/new/700_projects/jawcode/crates/brush-core-vendored/Cargo.toml:1`, `/Users/jun/Developer/new/700_projects/jawcode/crates/brush-core-vendored/Cargo.toml:12`, `/Users/jun/Developer/new/700_projects/jawcode/crates/brush-core-vendored/Cargo.toml:49` |

### M1/M2 관점의 의미

| 구분 | 현재 상태 | 개발 판단 | 근거 |
|---|---|---|---|
| M1 `jwc` 표면 | `packages/jwc`는 Node launcher + managed Bun runtime wrapper다. | 공개 표면은 `packages/jwc`와 coding-agent CLI help/branding에서 jwc 기준으로 유지한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/bin/jwc.js:1`, `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/000_roadmap.md:12` |
| M2 임베딩 | `jawcode/sdk`가 `@gajae-code/coding-agent/sdk`를 재수출한다. | cli-jaw는 내부 `@gajae-code/*`가 아니라 `jawcode/sdk`를 import해야 리베이스 흡수 지점이 생긴다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/src/sdk.ts:1`, `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/package.json:15` |
| Node 포팅 위험 | package engines는 Bun `>=1.3.14`가 기본이다. | M2 Node 포팅은 `bun:sqlite`, Bun imports, Bun APIs를 별도 밴드에서 다뤄야 한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/package.json:77`, `/Users/jun/Developer/new/700_projects/jawcode/packages/agent/package.json:48`, `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/05_interview_conclusions.md:17` |
| **M2 Node 포팅 — 100밴드 완료 (260613)** | `packages/jwc/dist-node/`(esbuild 번들) + `packages/jwc/src/shims/`: global Bun shim, file/write/sleep/stdio, `Bun.spawn`/`spawnSync` Node 어댑터, data-core(`bun:sqlite`/hash/JSONL/JSON5/stripANSI), peripheral shims. Node 22 SDK import·`createAgentSession`·스트리밍 green, 적대 감사 라운드 1-5 통과(보안: path traversal·archive mtime·serve TLS/disconnect·PK-tar misroute 포함, `0debe38b`·`40a4a2f0`). | "문서만"에서 **구현 완료**로 전환 — Bun API가 dist-node 셰임으로 대체됨. | `packages/jwc/scripts/build-node.ts`, `packages/jwc/src/shims/`, devlog 100밴드 (`2e9efc59`…`fba5cd56`, closeout `fdb8d41d`) |


---

# (merged) SDK Surface


---

## SDK Surface

> cli-jaw 임베딩 관점의 단일 통로는 `jawcode/sdk`다. 현재 `jawcode/sdk`는 `@gajae-code/coding-agent/sdk`를 그대로 재수출한다.

### Public Boundary

| 표면 | 의미 | 근거 |
|---|---|---|
| `packages/jwc/src/sdk.ts` | jawcode가 외부 호스트에 제공하는 SDK boundary. 현재는 coding-agent SDK 재수출. | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/src/sdk.ts:1` |
| `packages/jwc/package.json` export `./sdk` | `import "jawcode/sdk"` 공개 export. | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/package.json:15` |
| `packages/coding-agent/src/sdk.ts` | 실제 구현체. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:217` |

### `CreateAgentSessionOptions`

| 옵션 | 타입/계약 | cli-jaw 임베딩 의미 | 근거 |
|---|---|---|---|
| `cwd?: string` | project-local discovery 기준 작업 디렉토리. | cli-jaw Project root를 반드시 명시 주입해야 한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:217` |
| `agentDir?: string` | 기본 global config dir는 `~/.jwc/agent`. | M2에서 `.cli-jaw` 기반 agentDir 또는 bridge 정책을 결정해야 한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:220`, `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:216` |
| `authStorage?: AuthStorage` | credential store 직접 주입. | D7 로컬 토큰 시딩/OAuth 공유의 주입 지점. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:225`, `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/05_interview_conclusions.md:16` |
| `modelRegistry?: ModelRegistry` | authStorage를 가진 model registry. | `authStorage`와 다른 인스턴스면 startup에서 error. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:227`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:807` |
| `model?: Model`, `modelPattern?: string`, `thinkingLevel?: ThinkingLevel` | model selection / deferred model pattern / thinking selector. | cli-jaw settings의 per-runtime model 선택을 이 레이어로 매핑한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:230`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:232`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:235` |
| `systemPrompt?: string[] \| fn` | default prompt를 array로 대체하거나 function으로 변환. | cli-jaw PABCD/skills/global prompt를 끼우는 가장 직접적인 hook. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:240`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1613` |
| `customTools?: (CustomTool \| ToolDefinition)[]` | builtin tools 외 custom tools 등록. | cli-jaw tool bridge를 붙일 수 있는 표면. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:246` |
| `skills?: Skill[]` | caller-provided skills. | 명시 주입해도 bundled 4 workflow skill은 보존된다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:265`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1001` |
| `contextFiles?: {path, content}[]` | AGENTS.md 등 context files 선주입. | cli-jaw가 이미 계산한 context를 주입해 재탐색을 줄일 수 있다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:269`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:849` |
| `promptTemplates?: PromptTemplate[]` | prompt templates 선주입. | `.jwc/prompts`와 global prompts 대신 cli-jaw prompt catalog를 연결할 수 있다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:273`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:853` |
| `slashCommands?: FileSlashCommand[]` | file-based slash commands 선주입. | 현재 discovery helper는 빈 배열이라 host 선주입이 더 중요하다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:275`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:857` |
| `eventBus?: EventBus` | shared event bus. | cli-jaw bus/SSE 매핑의 후보 지점. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:262`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:799` |
| `sessionManager?: SessionManager` | session store override. | M2 jaw.db 영속화 또는 adapter 방식의 핵심 결정 지점. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:311`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:877` |
| `settings?: Settings` | settings instance override. | cli-jaw settings와 jwc settings bridge 가능. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:317`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:830` |
| `shouldPause?: () => boolean` | Agent cooperative pause checkpoint. | goal/autonomy pause integration 후보. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:337` |

### Discovery / Builder Functions

| 함수 | 시그니처 | 현재 동작 | 근거 |
|---|---|---|---|
| `discoverAuthStorage(agentDir = getDefaultAgentDir())` | `Promise<AuthStorage>` | broker config가 있으면 remote broker snapshot, 아니면 `<agentDir>/agent.db` SQLite auth store를 연다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:409`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:410`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:425` |
| `discoverExtensions(_cwd?)` | `Promise<LoadExtensionsResult>` | 현재 SDK helper는 빈 extension result를 반환한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:437` |
| `discoverSkills(_cwd?, _agentDir?, _settings?)` | `Promise<{skills,warnings}>` | 현재 SDK helper는 빈 배열을 반환한다. 실제 세션은 내부 `loadSkills()`를 사용한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:444`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:449`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1011` |
| `discoverContextFiles(cwd?, agentDir?)` | `Promise<Array<{path,content,depth?}>>` | cwd에서 AGENTS.md context를 load한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:456`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:460` |
| `discoverPromptTemplates(cwd?, agentDir?)` | `Promise<PromptTemplate[]>` | global/project prompt templates를 로드한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:468`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/config/prompt-templates.ts:265` |
| `discoverSlashCommands(_cwd?)` | `Promise<FileSlashCommand[]>` | 현재 SDK helper는 빈 배열을 반환한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:478`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:479` |
| `discoverCustomTSCommands(_cwd?, _agentDir?)` | `Promise<CustomCommandsLoadResult>` | 현재 SDK helper는 빈 commands/errors를 반환한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:485`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:486` |
| `buildSystemPrompt(options)` | `Promise<BuildSystemPromptResult>` | internal builder에 cwd/skills/contextFiles/appendPrompt/repeatToolDescriptions를 전달한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:493`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:508`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:509` |
| `createAgentSession(options)` | `Promise<CreateAgentSessionResult>` | model/auth/settings/session/tools/prompt를 조립해 `AgentSession`을 만든다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:796`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:807`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:877` |

### `createAgentSession()` 내부 순서

| 단계 | 내용 | 근거 |
|---|---|---|
| 1 | `cwd`, `agentDir`, `eventBus`를 확정한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:796` |
| 2 | `modelRegistry`를 만들고, `authStorage`와 registry authStorage가 다르면 error. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:807`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:811` |
| 3 | `Settings.init({cwd, agentDir})`를 기본 settings로 사용한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:830` |
| 4 | workspace tree, context files, prompt templates를 병렬 준비한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:840`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:846` |
| 5 | `SessionManager.create(cwd, SessionManager.getDefaultSessionDir(cwd, agentDir))`를 기본 session manager로 사용한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:877` |
| 6 | skills는 caller-provided list 또는 `loadSkills()` 결과에 embedded default 4종을 합친다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1001`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1011`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1019` |
| 7 | `rebuildSystemPrompt()`가 memory instructions, MCP server instructions, tools, skills, rules를 합쳐 default prompt를 만들고 `options.systemPrompt`로 최종 변환한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1551`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1570`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1594`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1613` |

### 임베딩 주의점

| 주의점 | 이유 | 근거 |
|---|---|---|
| `discoverSkills()` 이름만 믿으면 안 된다. | SDK helper는 빈 배열이고, 실제 session path는 `loadSkills()`를 직접 호출한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:444`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1011` |
| `options.skills=[]`를 줘도 default workflow 4종은 제거되지 않는다. | `withEmbeddedDefaultGjcSkills()`가 명시 skill list에도 default skill을 추가한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:786`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1003` |
| `authStorage`는 `modelRegistry.authStorage`와 동일 인스턴스여야 한다. | 불일치 시 error를 던진다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:807`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:811` |
| cli-jaw prompt injection은 `options.systemPrompt` function이 가장 작다. | default prompt를 받은 뒤 final blocks를 반환할 수 있다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:240`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1619` |
