# 03 — 로드맵 + 미해결 결정

> ⚠️ **[구원칙 폐기 — 인터뷰 260612 02:04]** 본 문서의 'gjc diff-0 / 무수정 추종 / 런타임 치환 / 무회귀' 서술은 폐기된 구원칙 기록이다. 현행 원칙은 **소스 하드 수정**(Jaw/jwc 어휘 직접 기입, 가드 jwc 기준 반전) — [085.5 개정판](./085.5_plan_prompt_rebrand.md) · [095](./095_plan_debt_cleanup.md) 참조.

> 단계별 개요. diff 레벨 플랜은 각 Phase 착수 시 `10_*`, `20_*`…로 작성한다.
> **2026-06-12 방향 확정 (병준님):** RPC/JSONL 사이드카 응답 방식 기각.
> 최종 형태는 **cli-jaw 서버 프로세스 안에서 서버 수명과 함께 상주(resident)하는
> 완전 네이티브 런타임**. 단, 순서는 jwc(독립 CLI)를 먼저 만들되
> 임베딩 호환을 설계 제약으로 유지한다.

## 목표 아키텍처: 상주 런타임 (JawRuntime)

```
cli-jaw 서버 (단일 프로세스, 서버 수명 = 런타임 수명)
└─ JawRuntime 서비스 (싱글톤)
   ├─ AgentSession 풀 — createAgentSession() 인스턴스, 메모리 상주
   │    · prompt = 살아있는 세션에 메시지 push (spawn 없음)
   │    · steer  = 루프 진행 중 메시지 주입 (kill-respawn 없음)
   │    · resume = jaw.db에서 메시지 로드 후 세션 재구성 (세션ID 역추적 없음)
   ├─ AgentEvent → core/bus broadcast 매핑
   └─ 스킬/PABCD 프롬프트 브리지
```

## 결정 1: 호스팅 방식 — ✅ 확정

| 옵션 | 내용 | 판정 |
|------|------|------|
| A. Node 포팅 | `Bun.*` 사용처를 Node 22 대응물로 치환 | ✅ **본선** — 진짜 in-process 상주의 유일한 길 |
| B. cli-jaw를 Bun으로 | 서버 자체를 Bun에서 구동 | ❌ 기각 — better-sqlite3/Electron 전면 재검증 리스크 |
| C. Bun 사이드카 (rpc) | JSONL 응답 프로세스 | ❌ **기각 (사용자 결정)** — pi-runtime의 개선판일 뿐, 상주 네이티브 아님 |

A 포팅 범위: 서버 임베딩에 필요한 `packages/ai` + `packages/agent` +
`coding-agent`의 비-TUI 경로만 (tui의 `Bun.*` 7파일은 jwc CLI 전용으로 Bun 유지 가능).

치환 매핑 (A용):
`Bun.env`→`process.env` · `Bun.hash`→`node:crypto`/xxhash · `Bun.file`→`node:fs/promises` ·
`Bun.spawn`→`node:child_process` · `Bun.WebSocket`→Node 22 전역 WebSocket(undici) ·
`Bun.JSONL.parseChunk`→자체 청크 파서 (base-stream.ts 403줄 내 국소화) ·
`Bun.JSON5`→`json5` npm

## 결정 2: 스킬 단일 소스

`~/.cli-jaw/skills`를 정본으로 유지하고 jawcode가 읽게 한다 (권고).
업스트림 AGENTS.md 계약상 gjc 기본 워크플로 셋(4종)은 건드리지 않고,
`.gjc` 사용자 디스커버리 경로 또는 `createAgentSession()` 주입으로 들어간다.

## 결정 3: 세션 소유권

jaw.db 정본 (권고) — Web/Telegram/Discord 인터페이스가 이미 jaw.db를 본다.
gjc agent db는 내부 구현으로 두되 메시지 영속화 어댑터로 jaw.db에 기록.

## 단계 로드맵 (2026-06-12 개정: jwc 먼저, 사이드카 단계 제거)

| Phase | 데케이드 | 내용 | 완료 기준 |
|-------|----------|------|-----------|
| 1 | 10–19 | **jwc 셸 구축**: `packages/jwc` 신설 — `jwc` bin + SDK 재수출 표면(`jwc/sdk`). 업스트림 무수정. 임베딩 호환 표면을 여기서 고정 | `jwc --version`/`--help` 동작, `jwc/sdk`에서 `createAgentSession` import 가능 |
| 2 | 20–29 | **Node 호환 포팅 (옵션 A)**: ai+agent+비TUI coding-agent의 `Bun.*` 치환 — 듀얼 런타임(Bun CLI는 그대로, Node import 가능) | 업스트림 테스트(stream.test.ts 등)가 Node 22에서 통과 |
| 3 | 30–39 | **상주 런타임 통합**: cli-jaw에 `JawRuntime` 서비스 — `createAgentSession()` 세션 풀 상주, `spawnAgent` 어댑터(`child:null`), AgentEvent→bus | 서버 기동 시 런타임 상주, Web UI에서 spawn 없이 대화+도구 실행 |
| 4 | 40–49 | **세션/스킬/PABCD**: 메시지 jaw.db 영속화(resume=DB 로드, steer=push), 전역 스킬 주입(결정 2), PABCD 단계 프롬프트 | resume-classifier 없는 재개/스티어, `/pabcd` 풀 사이클 |
| 5 | 50–59 | **TUI**: jwc interactive-mode(Bun)를 cli-jaw 서버 WS에 연결하는 얇은 클라이언트로 | 터미널에서 `jwc` ↔ 서버 상주 세션 공유 |
| 6 | 60–69 | **메인 런타임 승격**: 기본 cli=`jawcode`, 벤더 CLI는 fallback 체인으로 강등 | 신규 세션 기본값 전환 |

## 리스크 레지스터

1. **업스트림 드리프트** — 0.4.x 활발히 개발 중. 분기마다 `git fetch upstream` 리베이스,
   `models.json`은 무수정 추종 (conventions.md §2)
2. **OAuth ToS 그레이존** — 구독 OAuth를 비공식 클라이언트로 사용. 메인 런타임 승격 시 노출 증가
3. **도구 패리티** — 벤더 CLI 고유 기능(웹검색 등)은 gjc tools/ + cli-jaw `lib/mcp`로 충당 범위 정의 필요
4. **Phase 4 포팅 검증** — 업스트림 테스트(stream.test.ts 1,662줄 등)를 Node에서 통과시키는 게 기준선
