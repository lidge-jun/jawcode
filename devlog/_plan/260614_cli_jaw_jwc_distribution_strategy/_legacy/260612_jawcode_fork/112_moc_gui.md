# 112 MOC — GUI (cli-jaw 네이티브 런타임 GUI + Claude Desktop 연계)

> 상태: ⬜ [제안] + **D112-1 [확정 260612 21시] 2-트랙 표면 구분** (§Chat/Code 2-트랙).
> 입력: 사용자 "GUI 구현 혹은 cli-jaw 앱에서 네이티브로 런타임 GUI, Claude Desktop 관련 조사" (260612 06시)
> + "cli-jaw 내부에 code 모드 — electron cli-jaw와는 별개로 jwc를 실행하는 모드" (260612 21시, 스크린샷 기준).
> 조사: 웹 리서치 서브에이전트 (Claude Desktop 표면 / 네이티브 GUI 옵션 / 선행 사례 3트랙).
> 소속: 110 밴드 (JawRuntime 상주 서비스의 표면 트랙) — jwc가 cli-jaw에 임베드되면 GUI는 cli-jaw 대시보드/셸이 표면이 된다.
> **260613 플립 기준 재구체화 (gjc→jwc flip 반영)**: 본 문서 코드 사실은 cli-jaw 측 위주라 플립
> 영향 최소. 엔진 측 교차 갱신 — Code 모드가 소비할 이벤트/세션 표면은 `src/jwc-runtime/`·
> `modes/acp/`(`_jwc/` extMethod canonical, `_gjc/` legacy 별칭)·`modes/bridge/` 기준. **연기 계약
> 주의**: HTML export의 `gjc-share:v1:*` localStorage 키·`"GJC Session Export"` 타이틀은 기존
> export 파일 호환 때문에 플립 연기 — Code 모드가 export 뷰를 재사용한다면 이 키를 그대로 읽을 것
> ([260613_gjc_flip/05](../../_fin/260613_gjc_flip/05_plan_flip.md) §연기). 113(웹 네이티브 표면)이 본
> 밴드의 데이터 계약 자매 문서.

핵심 발견: **cli-jaw에는 electron 데스크톱 셸이 이미 절반 구축되어 있다.** 따라서 이 밴드의 본선은
"새 GUI 만들기"가 아니라 **기존 셸 완성**이고, Claude Desktop은 주 GUI가 될 수 없어 보조 채널로만 쓴다.

## 코드 사실 (cli-jaw, 260612 실사)

- 서버: Node ≥22.4 + Express 단일 서버, 기본 포트 **3457** (`/Users/jun/Developer/new/700_projects/cli-jaw/server.ts:139`,
  `src/core/config.ts:44`). 라우트 ~30모듈 (`src/routes/`)
- 대시보드: `public/` 정적 웹앱 + **`manifest.json` + `sw.js` → 이미 PWA 설치 가능**.
  실시간은 WebSocket이 아닌 **SSE** (`GET /api/events`; legacy WS 제거 — `server.ts:316` 주석)
- **`electron/` 셸 존재 (v0.1.0, 진행 중)**: electron-vite + electron-builder. `jaw dashboard serve`
  attach 또는 직접 spawn, 패키징 시 `extraResources/server` Node sidecar, `node-pty` 포함,
  관리 레인 24576(웹)/24577–24590(Electron) — `electron/README.md`, `electron/package.json` (electron ^41.4.0)
- jawcode `packages/tui`는 터미널 전용 차등 렌더러 — GUI 전용 불가, 본 밴드와 무관

## Claude Desktop을 GUI로 쓰는 길 — 가능/불가능 경계

**가능 (공식 지원)**:

- 로컬 stdio MCP 서버의 원클릭 설치 — `.dxt`는 **`.mcpb`(MCP Bundles)로 개명**되어 MCP 프로젝트에 기증됨
  > 출처: [modelcontextprotocol/mcpb](https://github.com/modelcontextprotocol/mcpb), [MCP 블로그 2025-11-20](https://blog.modelcontextprotocol.io/posts/2025-11-20-adopting-mcpb/), [Anthropic 엔지니어링](https://www.anthropic.com/engineering/desktop-extensions)
- **MCP Apps 리치 UI 인라인 렌더링 — 이미 출시**: SEP-1865 Final, 2026-01-26 Claude Desktop 포함 전 플랫폼
  출시. 툴의 `_meta.ui.resourceUri` → `ui://` HTML 리소스 → 샌드박스 iframe + postMessage JSON-RPC
  > 출처: [SEP-1865](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp), [MCP Apps 스펙](https://modelcontextprotocol.io/extensions/apps/overview), [Claude 블로그](https://claude.com/blog/interactive-tools-in-claude)
- 리모트 MCP 커넥터 — 단, Anthropic 클라우드에서 접속하므로 localhost:3457 직결 불가
  > 출처: [커스텀 커넥터 가이드](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)

**불가능 (경계)**:

- 외부 런타임의 **상주 프론트엔드**로 쓰기 — MCP 서버가 대화를 개시하거나 사이드바/패널 상주 불가,
  MCP App UI는 툴 호출 결과로 대화 안 인라인만
- Claude Desktop은 MCP sampling ❌ / roots ❌ — cli-jaw가 Desktop의 모델을 빌려 쓰는 것도 불가
  > 출처: [MCP clients 매트릭스](https://github.com/modelcontextprotocol/docs/blob/main/clients.mdx)

→ **결론: Claude Desktop = 보조 표면** (`.mcpb`로 jaw 툴 노출 + MCP Apps로 상태 보드 인라인). 주 GUI 불가.

## 네이티브 GUI 4옵션 — MLB 20-80 스카우팅

| 옵션 | 개발비용 | 유지보수 | UX | Bun호환 | 배포 | 총평 |
|---|---|---|---|---|---|---|
| **Electron (기존 셸 완성)** | **65** | 50 | 60 | 45 | 40 | 셸이 이미 있어 한계비용 최저. Bun은 sidecar만 |
| Tauri v2 | 45 | 60 | 55 | 60 | 60 | 번들 ~9MiB, `bun --compile` sidecar 공식 수용. 단 전면 재작성 + Rust 툴체인 |
| Neutralinojs | 55 | 45 | 45 | 60 | 65 | 경량이나 소규모 팀, 자식 프로세스 정리 미흡 |
| PWA + Add to Dock | 70 | 65 | 50 | 70 | 75 | 빌드 제로 — `public/`이 이미 PWA, 오늘 바로 가능 |

근거 (주요):
> 출처: [Hopp Tauri vs Electron 벤치마크](https://www.gethopp.app/blog/tauri-vs-electron) (번들 244MiB vs 8.6MiB),
> [electron#34876](https://github.com/electron/electron/issues/34876) (Bun main 프로세스 공식 거절),
> [Tauri sidecar 문서](https://v2.tauri.app/develop/sidecar/) · [Node.js sidecar 가이드](https://v2.tauri.app/learn/sidecar-nodejs/),
> [Bun 단일 바이너리](https://bun.com/docs/bundler/executables) (darwin-arm64 크로스 타깃),
> [Apple — Add to Dock](https://support.apple.com/en-us/104996),
> [Apple — 로컬 빌드 앱은 quarantine 미적용 → 공증 불필요](https://support.apple.com/guide/security/gatekeeper-and-runtime-protection-sec5599b66df/web)

## 선행 사례 교훈

| 프로젝트 | 스택 | 상태 |
|---|---|---|
| [opcode (구 claudia)](https://github.com/winfunc/opcode) | Tauri 2 + React, Claude Code 래퍼 | 2025-10 이후 정체 |
| [Crystal](https://github.com/stravu/crystal) | Electron, CLI 병렬 worktree | 2026-02 deprecated |
| [vibe-kanban](https://github.com/BloopAI/vibe-kanban) | Rust+React 멀티 CLI | 선셋 공지 |
| [opencode](https://github.com/anomalyco/opencode) | **자체 서버 + OpenAPI/SSE 클라이언트 분리** | 매우 활발 |
| [happy](https://github.com/slopus/happy) | Expo/RN + E2E 동기화 | 활발 |

**패턴**: 단순 CLI 래퍼는 1st-party GUI([Claude Code Desktop 탭](https://code.claude.com/docs/en/desktop-quickstart)) 등장 후 줄줄이
정체/아카이브. 생존한 건 자체 클라이언트/서버 프로토콜 보유(opencode형) — **cli-jaw는 이미 opencode형 구조라 유리**.
Agent SDK로 커스텀 GUI를 만드는 것은 공식 권장 패턴이나, 배포 제품은 API 키 필수 + 2026-06-15부터
구독 플랜 SDK 사용은 별도 크레딧 차감.
> 출처: [Agent SDK 개요](https://code.claude.com/docs/en/agent-sdk/overview), [Claude 플랜의 SDK 사용 정책](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)

## [제안] 추천안

1. **즉효 (0비용)**: Safari **Add to Dock**으로 `localhost:3457` 대시보드를 독립 앱화 — 오늘 가능
2. **본선**: 기존 `electron/` 셸 완성 — jwc는 `bun build --compile` 바이너리를 `extraResources`
   sidecar로 탑재 (Bun이 main이 될 수 없으므로 어떤 프레임워크든 동일한 답; M2 임베딩과 정합)
3. **보조**: Claude Desktop용 `.mcpb` 번들 + MCP Apps 상태 패널 — 주 GUI 아님, 역할 분담
4. 개인용 로컬 빌드는 공증/$99 불필요 (quarantine 미적용, ad-hoc 서명으로 충분)

## Chat/Code 2-트랙 [확정 D112-1, 260612 — 사용자 명시]

**두 트랙은 별개 구현이다. 혼동 금지.**

| 트랙 | 무엇 | jwc가 들어가는 방식 | UI 작업 |
|------|------|---------------------|---------|
| **Chat 모드** | 기존 cli-jaw 대화 표면 (boss/직원, 대시보드) | **엔진 교체** — 110/111 in-process 부착 + 130 주입. 유저는 같은 채팅 UX, 밑에서 jwc 상주 | 신규 UI 없음 (기존 electron 셸/PWA 그대로) |
| **Code 모드** | Claude Code 데스크톱 스타일 코딩 세션 패널 — **260612 스크린샷 기준 별도 구현** | jwc `AgentSessionEvent` 스트림을 직접 렌더 (boss 파이프라인 경유 안 함) | **신규** — 본 밴드의 1급 deliverable |

Code 모드 구성 요소 (스크린샷 대응):

1. Chat ↔ **Code** 모드 토글 (상단)
2. **작업장 피커**: `Local · <repo 폴더> · <branch> · worktree` — `createAgentSession(cwd)` + `jwc worktree`,
   로컬/폴더/워크트리 표시를 1급으로
3. 세션 사이드바 + Recents (jwc 세션 jsonl / `/resume` 데이터)
4. 스트리밍 채팅 렌더 — 도구 셀·thinking 접기(083 문법의 웹 컴포넌트 재현), 권한 승인 다이얼로그
5. 사용량 대시보드 (세션·메시지·토큰·스트릭 — `jaw.db` + jwc usage 통계)

단계 경로: **① ACP-선행 프로토타입** (`jwc acp` stdio — 100 밴드 완료 전 즉시 가능, 프로세스 1개 추가)
→ **② in-process 승격** (100/110 완료 후, sidecar 이벤트를 서버가 SSE로 중계).

**[확정 260612 — 사용자, 모드별 렌더링 전략] 명칭은 "jaw 모드 ↔ Code 모드":**

| 모드 | 렌더링 | 근거 |
|------|--------|------|
| **jaw 모드** | 기존 cli-jaw web UI(`public/` 대시보드)를 **iframe/웹뷰 임베드** | 이미 별도 웹앱(PWA·SSE) — 재작성 0, 서버 SoT 유지, 웹↔electron 패리티 자동 |
| **Code 모드** | **네이티브 React — electron 렌더러의 현행 매니저 문법으로 통합** (1급 뷰, iframe 금지) | 신규 표면 — 도구 셀·thinking 접기·권한 다이얼로그·키보드를 1급 제어, iframe 브리지 마찰 없음 |

(MCP Apps의 iframe 패턴은 Claude Desktop **보조 트랙 전용** — 본선과 무관.) 전송 계층(ACP stdio ↔
in-process)은 **transport 어댑터 경계 뒤로 격리** — ①→② 승격 시 UI 무변경이 완료 기준.

모드 경계 착수 시 확인 3건: ① 디자인 토큰 공유(웹뷰 jaw ↔ 네이티브 Code 테마 일관), ② 모드 전환 시
각 모드 상태 보존, ③ 크로스 모드 딥링크("jaw 채팅에서 이 레포를 Code 모드로 열기" — webview postMessage
또는 서버 SSE 경유 브리지 1개).

D130-1 정합: Chat=boss 파이프라인 스코프(cli-jaw DB 정본), Code=세션 로컬 스코프(jwc 상태 파일) —
**모드 분리가 스코프 분리와 1:1로 대응**하므로 상태 충돌 없음.

## 인스턴스 vs 세션 [확정 D112-2, 260612 — 사용자 명시]

**cli-jaw와 jwc의 본질 차이는 수명·정체성이다:**

| | cli-jaw (인스턴스) | jwc (세션) |
|---|---|---|
| 수명 | **영속** — 상주하는 자체 인격체 | **일회용·병렬** — 워크트리/폴더마다 띄웠다 버림 |
| 메모리 | **주체** — soul/profile/episodes 축적, 기억의 정본 | **소비자** — 주입받아 쓰고, 세션 종료와 함께 휘발 가능 |
| 스킬/조작 | 설치·관리·sync가 일어나는 곳 (`~/.cli-jaw/skills`) | 주입된 스킬을 읽어 수행만 |
| 동시성 | 1개 (서버당) | N개 동시 (Code 모드 멀티 세션·워크트리) |

설계 파급:

1. **임베디드(M2) 메모리 방향**: 영속 기억의 정본은 cli-jaw — jwc 세션에는 **하향 주입**(Profile/Soul/Task
   Snapshot, 130 스코프 A 패턴과 동형). jwc 자체 consolidation(memories stage1/phase2)은 임베디드 모드에서
   **비활성 [확정 260612 — 사용자]** — 세션은 주입만 받는 소비자, 자체 축적 없음 (이중 기억 방지).
   기억할 가치는 cli-jaw flush/reflect가 수확. (격하안·현행 유지안 기각 — 세션이 일회용인데 정체성을 축적하면 모순.)
   (단독 실행 jwc(M1)는 현행 자체 메모리 유지 — 이 원칙은 임베디드 아키텍처에만 적용.)
2. **상향은 보고**: jwc 세션의 작업 결과가 기억할 가치가 있으면 cli-jaw의 flush/reflect 파이프라인이
   수확 — 세션이 직접 cli-jaw 메모리에 쓰지 않음 (D130-1 단방향 원칙의 메모리판).
3. Code 모드 UI 함의: 세션은 가볍게 만들고 가볍게 버리는 UX (새 세션 비용 ≈ 0) — 세션별 영속 설정을
   최소화하고 인스턴스 레벨(cli-jaw 설정)에서 상속.

## Code 모드 fork UX [확정 D112-4, 260613 — 사용자]

**fork는 "기존 채팅 유지 + 새 convo 생성"** — TUI(99.07.01)의 in-place 전환과 표면이 다르다:

| | TUI `/fork` (99.07.01 랜딩) | Code 모드 (웹/electron) |
|---|---|---|
| 원본 세션 | 보존되지만 화면은 떠남 (단일 뷰포트 제약 → 풀 id 복귀 안내 출력) | **convo 목록·뷰 그대로 유지** — 복귀 안내 자체가 불필요 |
| 새 세션 | 같은 뷰포트가 in-place 전환 | **새 convo 항목이 목록에 생성** + 포커스가 새 convo로 이동 |
| 엔진 | `AgentSession.fork()` (전체 복제 + `parentSession` 링크) | **동일 — 엔진 동사 재사용, 표면만 다름** (113 원칙: 의미론은 jwc, 웹은 뷰) |

- 와이어 (113.1 v2 후보): `POST /api/jwc/sessions/:id/fork` → `{newSessionId, parentSession}` + SSE
  `session_created {forkedFrom}` — cli-jaw chat-sessions의 기존 이벤트 형태(`forkedFrom`)와 동형이라 대시보드 수신부 선례 재사용.
- D112-2 정합: 세션은 일회용·병렬·생성비용 ≈ 0 — fork가 목록에 convo 하나 더 만드는 건 그 원칙의 자연스러운 표현.
- claude.ai 웹 분기 모델과도 동형 (원본 대화 무손상 + 새 대화로 이어가기).

## 완료 기준

- electron 앱 기동 → cli-jaw 서버 attach/spawn + 대시보드 렌더 + jwc sidecar로 대화 1회 e2e
- (보조 트랙 착수 시) Claude Desktop에 `.mcpb` 설치 → jaw 툴 1회 호출 + MCP Apps 패널 1회 렌더
- **Code 모드 (D112-1)**: 모드 토글 → 폴더/워크트리 선택 → jwc 세션 1회 e2e (도구 셀 접기 렌더 + 권한 다이얼로그 동작)

## 문서 거버넌스 [확정 D112-3, 260613 — 사용자]

**MVP 구현까지의 설계·추적 정본은 jawcode devlog** (본 112.x·113.x·110.x·130.x 체인).
cli-jaw devlog(`_plan/260613_jwc_code_mode/`)는 **사후 구현 기록 전용** — 구현이 랜딩된 뒤
무엇이 어떻게 들어갔는지(_fin 이동 포함)만 기록한다. 설계 변경·결정·블로커 추적을 cli-jaw 쪽에
이중 기재하지 않는다 (드리프트 방지 — cli-jaw 01_jawcode_refs.md가 정본 포인터 역할).

## 열린 질문 (착수 전 인터뷰)

1. 착수 시점 — M2 110–139(상주 런타임) 완료 전 electron 셸을 먼저 완성할지, 후행할지
   → **[확정 260612 — 사용자] Code 모드 선행**: M1(99 밴드) 마감 후 **Code 모드(ACP 프로토타입)
   먼저 → 100/110 런타임 통합 → Code 모드 in-process 승격 + Chat 엔진 교체** 순. 근거: ① ACP 경로는 100
   Node 포팅 없이 즉시 가능(런타임 통합은 100이 게이트라 무거움), ② Code 모드에서 만드는 웹 렌더 자산
   (도구 셀·thinking 접기·권한 다이얼로그)이 이후 통합 표면에 그대로 재사용 — 통합의 "표면 절반"을 선납,
   ③ D112-2상 Code 모드(일회용 세션)는 130 메모리/스킬 주입 없이도 성립 — 의존성 독립, ④ 사용자 체감
   가치가 즉시 발생(Chat 엔진 교체는 UI 무변화라 체감이 늦음).
2. ~~electron 셸의 jwc sidecar 탑재 방식~~ → **[해소 260612 — 사용자]** npm 설치 경로가 bun을 이미 책임짐
   (jwc 패키지 `engines.bun` + `dist/jwc.bundle.js` bun-타깃 번들, P12 퍼블리시 독립화) — sidecar는
   **기존 npm 배포 메커니즘 재사용**, electron은 설치본을 spawn. `bun --compile` 단일 바이너리는
   패키징 시점 옵션으로 강등 (오프라인 배포 필요 시에만 재검).
3. ~~Claude Desktop 보조 트랙(`.mcpb`+MCP Apps)~~ → **[드랍 확정 260612 — 사용자]** "Code 모드가 그것" —
   cli-jaw electron 앱이 이미 데스크톱 표면이고 Code 모드가 그 역할을 수행. Desktop 트랙은 백로그에서도 제외
   (§Claude Desktop 절은 조사 기록으로만 보존).

## 세부 실행 문서 (260613 구체화)

- [112.3_plan_code_mode_impl.md](./112.3_plan_code_mode_impl.md) — S1~S4 슬라이스, B1~B4/C1/C2 흡수, **S1 즉시 착수 가능 (100 비의존)**
- [112.4_design_code_mode_ui.md](./112.4_design_code_mode_ui.md) — UI 시안 + [112.4_preview.html](./112.4_preview.html) 목업 (jaw|Code 토글 = 사이드바 로고 하단)
