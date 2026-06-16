# 098 — M2 실행 계획 (100 이후: 110–150)

> 범위: **100 밴드(Node 포팅) 완료를 전제**로, cli-jaw 상주 jwc 통합을 밴드·PR·검증 단위로 쪼갬.
> 정본 설계: [111_design_runtime_attach.md](./111_design_runtime_attach.md) · 밴드 MOC: 110/120/130/140/150/112.
> cli-jaw 루트: `700_projects/cli-jaw/` · 엔진 SDK: `jawcode/packages/jwc/src/sdk.ts` → `@gajae-code/coding-agent/sdk`.

## 0. M2가 끝나는 지점 (혼동 방지)

| 용어 | 의미 |
|------|------|
| **100 완료** | Node에서 `jwc/sdk` → `createAgentSession` import·스트림 가능 (서버 부착 **전제**) |
| **M2 done (공식)** | **130 완료** + 130 MOC **3항목** 검증 (spawn 없는 chat · 로컬 토큰 · 스킬 주입) |
| **150** | 기본 `cli=jwc` 승격 + 패리티 표 — **M2 done 이후** 안정화·제품화 |
| **140** | 대시보드 federated search — **후순위**, 150 승격 조건에 [기본값] 포함 |

```
100 ──► 110 ──► 120 ──► 130 ═══ M2 done
                      ╲
                       └──► 112 (GUI, 병렬 가능)
130 + 140 ──► 150 (승격)
```

---

## 1. 전제: 100에서 넘겨받는 산출물 (체크리스트)

100이 끝났다고 가정할 때 110 착수 전 **고정 계약**:

- [ ] `packages/jwc/dist-node/` (또는 합의 경로)에서 **Node 22**로 `createAgentSession` 로드
- [ ] `better-sqlite3` 경로로 agent/history DB 동작 (cli-jaw와 동일 런타임)
- [ ] `pi-natives` Node 로드 — cli-jaw `ensure:native`와 버전 호환
- [ ] Bun TUI 경로 **무회귀** (`bun test` jawcode)
- [ ] **임포트 금지**: cli-jaw는 `jwc/sdk` **단일** (내부 `@gajae-code/*` 직접 import 금지, 110 MOC)

**jawcode 측 고정 env (서버 기동 시):**

- `GJC_BRAND_NAME=jwc` → 030 스킬 3계층·`~/.cli-jaw/skills` 네이티브 디스커버리 (111 §0)
- `agentDir` = cli-jaw `JAW_HOME` 하위 합의 경로 (130 인증 공유)

---

## 2. 밴드 110 — JawRuntime 상주 (M2 핵심 ①)

**목표:** `spawnAgent`가 `cli=jwc`일 때 **자식 프로세스 0**, Web UI는 기존 SSE/bus만으로 스트리밍·도구 가시화.

### 2.1 신규/수정 파일 (cli-jaw)

| 파일 | 역할 |
|------|------|
| `src/agent/jwc-runtime.ts` | 싱글톤: 세션 풀, `prompt`/`steer`/`followUp`, dispose·재생성 |
| `src/agent/spawn.ts` | `cli === 'jwc'` 분기 **최상단 근처** — 기존 벤더 분기 전에 위임 |
| (선택) `src/agent/spawn/jwc-adapter.ts` | spawn.ts 비대화 방지 — `SpawnOpts`→JawRuntime 매핑만 |

**spawn 계약 보존 (111 §1, spawn.ts 실사):**

- `mainManaged` / `gateEligibleMain` / `employeeSessionId` / `internal` / `origin` / `target` 그대로
- `insertMessage` / `beginLiveRun` / `handleAgentExit` / `processQueue` — jwc 경로도 **동일 호출 순서**
- busy: `activeProcess` 대신 **in-flight promise** + `isAgentBusy()` 연동 (child 없음)

### 2.2 JawRuntime 내부 설계

```
sessionKey = f(workingDir, activeChatSession, mainManaged|employeeId)
  → 인스턴스당 Boss main 1세션 [확정 "단 하나의 jwc"]

createAgentSession({
  cwd: settings.workingDir,
  agentDir,
  // 130에서 확장: auth, identity, skills는 env/옵션
})

prompt(text)     → session.prompt(text)
steer(text)      → session.prompt(text, { streamingBehavior: "steer" })
followUp(text)   → session.prompt(text, { streamingBehavior: "followUp" })
```

- **에러 격리:** try/catch per turn → 세션 `dispose` + Map에서 제거 + 재생성 (서버 프로세스 생존)
- **도구 실행:** gjc in-process — `activeProcesses`에 pseudo-handle 또는 별도 `jwcBusy` 플래그 (직원 spawn과 충돌 안 함)

### 2.3 AgentEvent → bus 매핑 (110 산출물: 표 문서화)

110 착수 시 `110_agent_event_bus_map.md` (또는 devlog 서브플랜)에 **고정 표** 작성:

| gjc AgentEvent (후보) | cli-jaw `broadcast` | Web UI 소비 |
|----------------------|---------------------|-------------|
| assistant text delta | `agent_stream` (기존 필드) | 채팅 버블 스트림 |
| tool start/end | `tool_log` / trace 파이프 | ProcessBlock |
| thinking | 기존 thinking 인터리브 (083.3 정합) | 추론 UI |
| error / compaction | `agent_done` / status | 토스트·상태줄 |

원칙: **새 SSE 타입 최소** — `public/manager` JS 수정은 매핑 불가 시에만.

### 2.4 110 작업 패키지 (PR 단위)

| PR | 내용 | 검증 |
|----|------|------|
| 110.1 | `jwc-runtime.ts` 스켈레ton + 단위 테스트(mock session) | 서버 기동, Map lifecycle |
| 110.2 | spawn early-return `jwc` + `child:null` + promise | `ps` 자식 0, 1턴 대화 |
| 110.3 | 이벤트 매핑 + liveRun/traceRunId 연동 | SSE e2e 1시나리오 |
| 110.4 | employee/internal 경로 회귀 | 기존 spawn 테스트 green |
| 110.5 | 예외 주입 → 서버 생존 | 110 MOC 완료 기준 3 |

**110 완료 = M2 done ①** (Web UI spawn 없이 대화+도구).

---

## 3. 밴드 120 — jaw.db 영속화 (resume/steer)

**목표:** 벤더 resume-classifier **우회**, 메시지 정본 = `~/.cli-jaw/jaw.db` `messages` (이미 스키마 존재: `src/core/db.ts`).

### 3.1 쓰기 경계 (계약)

- **턴 완료 시 1회** assistant/user 최종 기록 (스트리밍 중간 jaw.db write 금지)
- `insertMessage` / `insertMessageWithTraceRun` — jwc 경로에서 gjc 완료 콜백과 **동일 타이밍**
- `tool_log` JSON: gjc tool 결과 → cli-jaw `ProcessBlock` 직렬화 스키마 (120.2에서 확정)

### 3.2 읽기 / resume

| 시나리오 | 동작 |
|----------|------|
| 서버 재시작 | jaw.db `getMessages` → `createAgentSession` 시드 (API 실사: history/agent db vs 메시지 주입) |
| `/continue` 등 | `cli=jwc`면 `spawn/resume.ts`·classifier **스킵** |
| steer | JawRuntime `steer()` — **kill-respawn 없음** |

**jawcode 작업 (어댑터):**

- `packages/coding-agent/src/session/*` — 외부에서 메시지 배열 주입·export hook (110 P 실사 결과로 파일 확정)
- 충돌 규칙: **jaw.db 승**, gjc agent db = 캐시 (120 MOC)

### 3.3 120 작업 패키지

| PR | 내용 | 검증 |
|----|------|------|
| 120.1 | 메시지 매핑 표 (gjc Message ↔ jaw.db row) | 단위 round-trip |
| 120.2 | tool_log 직렬화 | UI 도구 블록 복원 |
| 120.3 | resume on cold start | 재시작 후 문맥 연속 e2e |
| 120.4 | steer e2e | 실행 중 주입, 프로세스 kill 없음 |
| 120.5 | AGY 회귀 테스트 이식 | raw/tracker 누출 0 |

**의존:** 110 이벤트·완료 시점 합의 (120.1).

---

## 4. 밴드 130 — 주입 + M2 done 선언

**목표:** 3항목 검증 후 **M2 공식 종료**.

### 4.1 스킬 (done ③)

**1차 (권장):** 서버 프로세스 env `GJC_BRAND_NAME=jwc` + cwd/agentDir — **030 네이티브 디스커버리** (111 §5).

검증:

- Web UI에서 `~/.cli-jaw/skills` 중 1개 트리거 e2e (예: diagram/search류)
- **중복 검사:** cli-jaw `prompt/builder.ts` 스킬 목록 + gjc discover 동시 주입 시 프롬프트 비대 — 130.1에서 builder 스킬 섹션 **jwc일 때 축소/위임**

### 4.2 프롬프트 합성 (아이덴티티)

단일 규칙 문서 `130_prompt_compose.md`:

1. cli-jaw A1 (`src/prompt/templates/a1-system.md`) vs jwc `system-prompt.md` **우선순위**
2. `identity.*` settings → gjc config 매핑 (020)
3. PABCD 단계 텍스트: **cli-jaw orchestrate 정본**, jawcode 051 리소스 **공유 경로** (사본 금지)

단계 도구 게이팅 (130.2):

- P/A: write/edit/bash mutation 차단 — gjc role read-only + orchestrate state 연동

### 4.3 인증 (done ②)

- 서버 `main()` 경로: AuthStorage 비어 있으면 090 시딩 제안/실행 (`discoverAuthStorage`)
- Web UI 신규 머신: Claude credentials만으로 1턴

### 4.4 M2 Done 게이트 (증거를 130 MOC에 기록)

| # | 검증 | 담당 PR |
|---|------|---------|
| ① | spawn 없는 jaw chat | 110.5 |
| ② | 로컬 토큰 → Web 대화 | 130.3 |
| ③ | 스킬 발동 e2e | 130.1 |

---

## 5. 병렬 트랙 112 — GUI (110 산출물 의존)

[112_moc_gui.md](./112_moc_gui.md) — **M2 done 필수 아님**.

| 단계 | 내용 | 의존 |
|------|------|------|
| 112.0 | PWA Add to Dock (`localhost:3457`) | 없음 |
| 112.1 | `electron/` 셸 — 서버 attach + 대시보드 | 110 최소 |
| 112.2 | jwc **sidecar** (`bun --compile` or Node dist-node) `extraResources` | **100** |
| 112.3 | (선택) Claude Desktop `.mcpb` + MCP Apps | 별도 ToS/범위 |

열린 질문 112: electron을 130 전에 할지 — **권장:** 110.3 SSE 안정 후 112.1.

---

## 6. 밴드 140 — Federation search (승격 전)

- `src/manager/memory/chat-federation.ts` — `probeSchema`에 gjc `history` / `history_fts` 경로
- jwc 세션 db 옵트인 등록 — `jwc:<agentDir>` 의사 instanceId
- **범위 밖:** jaw.db LIKE→FTS5 (D9)

완료: `dashboard chat search`가 jwc 히트 반환.

---

## 7. 밴드 150 — 기본 런타임 승격

### 7.1 선행

- 130 done 3항목 ✅
- 140 완료 [기본값 150 MOC]
- **패리티 갭 표** (150 첫 산출물) — 벤더 CLI vs jwc+`lib/mcp`

### 7.2 전환

| 항목 | [기본값] |
|------|----------|
| 신규 settings `cli` | `jwc` |
| 기존 인스턴스 | 값 존중 |
| fallback 체인 | claude/codex/… 유지 |
| 롤백 | settings 한 줄, 1릴리스 |
| 전수 검사 | heartbeat, goal, orchestrate, telegram/discord spawn 경로 |

### 7.3 승격 게이트

- 전 채널 스모크 (web/telegram/discord 최소 1 each)
- 110–130 e2e + 기존 AGY spawn 회귀
- OAuth ToS 재평가 문서 (090 이월)

---

## 8. 레포별 책임 매트릭스

| 작업 | jawcode | cli-jaw |
|------|---------|---------|
| Node 셰임·dist-node | **100** | consume `jwc` npm/workspace |
| createAgentSession API·steer | 엔진 | JawRuntime 호출만 |
| spawn 분기·bus·jaw.db | — | **110–120** |
| GJC_BRAND_NAME·시딩·스킬 | 엔진 설정 | 서버 env·기동 |
| orchestrate/PABCD 텍스트 | 051 공유 리소스 | 상태머신 정본 |
| electron sidecar | compile 산출 | 패키징 |
| federation | history 스키마 | chat-federation |

**빌드 계약 (cli-jaw AGENTS):** 서버 변경 = `npm run build` + 재시작 + `dist/` grep 검증 — jwc 통합 PR마다 CI에 dist 스모크 권장.

---

## 9. 권장 일정 (밴드 순서, 병렬 표기)

| 주차(상대) | 밴드 | 산출 |
|------------|------|------|
| W0 | 100 (전제) | dist-node green |
| W1 | 110.1–110.2 | jwc spawn 1턴 |
| W2 | 110.3–110.5 | SSE·격리·M2① |
| W3 | 120.1–120.4 | resume·steer |
| W4 | 130.1–130.3 | **M2 done** |
| W5 | 140 | search |
| W6 | 150 | 승격 + 패리티 |
| 병렬 | 112.0–112.2 | electron |

---

## 10. 리스크 · 완화 (M2)

| # | 리스크 | 완화 |
|---|--------|------|
| R1 | spawn.ts 2388줄에 분기 추가 | `jwc-adapter.ts` 추출, feature flag `cli=jwc` opt-in |
| R2 | 이벤트 순서/중복 | 110 매핑 표 + 120 완료 기록 1회 |
| R3 | 이중 컴팩션 | gjc 위임, cli-jaw compact → call-through |
| R4 | discoverSkills 스텁 | sdk 말고 문서화된 loadSkills 경로만 |
| R5 | dist 미반영 404 | gate:all + PR 체크리스트 |
| R6 | 직원 spawn 오염 | mainManaged 분기 테스트 (spawn 주석 INVARIANT) |

---

## 11. 다음에 쪼갤 diff 플랜 (100+ 전용) — ✅ 260613 전부 선행 작성 완료 (소넷 6기 병렬 실사 기반)

| 문서 | 시점 | 내용 |
|------|------|------|
| [110.3_plan_jawruntime_impl.md](../110.3_plan_jawruntime_impl.md) ✅ | 100 직후 착수 | spawn.ts:1047 삽입·JawRuntime API·테스트 목록 (구 `110_plan_jawruntime_impl`) |
| [110.4_map_agent_event_bus.md](../110.4_map_agent_event_bus.md) ✅ | 110.2 PR | 이벤트 1:1 고정 표 (구 `110_agent_event_bus_map`) |
| [120.1_plan_session_persistence_adapter.md](../120.1_plan_session_persistence_adapter.md) ✅ | 110 done 착수 | **이중 정본 분리 — §3 "메시지 정본 = jaw.db" 표현을 본 문서가 정정** (구 `120_plan_jawdb_adapter`) |
| [130.2_plan_injection_compose.md](../130.2_plan_injection_compose.md) ✅ | 120 mid 착수 | 프롬프트·스킬·auth 합성 + M2 done 게이트 (구 `130_plan_injection_compose`) |
| [150.1_parity_gap_matrix.md](../150.1_parity_gap_matrix.md) ✅ | 갭 표 채움은 130 done | 벤더 기능 vs jwc 35도구 (구 `150_parity_gap_matrix`) |
| [112.3_plan_code_mode_impl.md](../112.3_plan_code_mode_impl.md) ✅ (추가) | **즉시 착수 가능** | Code 모드 S1~S4 (§5 표의 112.0~112.3 단계 흡수) |
| [113.2_contract_stream_idempotency.md](../113.2_contract_stream_idempotency.md) ✅ (추가) | 계약 확정 | 스트림 멱등성 5조항 (트랙 C) |
| [140.1_plan_chat_federation_adapter.md](../140.1_plan_chat_federation_adapter.md) ✅ (추가) | 130 done 이후 | §6 federation 구체화 |

---

## 12. 본 문서(098) 완료 정의

- 100 이후 **110→120→130** 경로가 PR·검증·레포 책임까지 구체화됨
- M2 done / 150 / 140 / 112 역할 분리 명확
- 구현 착수 시 **110_plan**부터 순차 작성