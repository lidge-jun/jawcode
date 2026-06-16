# 00 — MOC: Codex 개선 (전송 계층 · TTFT)

> 밴드 구조: **00.x = Codex 유래 개선**(이 문서가 MOC), **10.x = 전반적 개선**
> ([10_moc_general_improvements.md](./10_moc_general_improvements.md)).
> 업스트림 포팅 시 라이선스: openai/codex는 **Apache-2.0** (MIT 아님) — 코드 이식 시
> NOTICE/attribution 보존 필요. jawcode AGENTS.md의 upstream attribution 규칙과 일치.

> 상태: 조사 ✅ (260613) / 검증 1차 ✅ (소형 컨텍스트, WS 정상) / 검증 2차 ✅ (대형 컨텍스트
> resume, TTFT 병목 위치 확정) / 수리 ⬜ — 실행 순서는 [00.01](./00.01_next_steps_ttft_first.md).
> **중요 보정**: 증상 ①(~1 tok/s)과 동일 현상이 네이티브 Codex에서도 광범위 보고됨
> (2026-05-24~ 서버측 저하, 미해결) — 급성 느림의 상당 부분은 업스트림 QoS. 개혁 목표는
> "업스트림 정상 시 네이티브 동급". 상세·출처·Codex SDK 탈출구는
> [00.02](./00.02_research_codex_rs_deep.md).
> 입력: 사용자 "gpt-5.5 fast인데도 툴사용이 너무 느린데?" → 네이티브 Codex 비교 지시 →
> "전반적인 툴콜링 루프의 버그 같으니까 계획을 기록해".
> 방법: jawcode `packages/ai` 정적 분석 + 네이티브 Codex(`~/Developer/codex/openai-codex/codex-rs`)
> 요청 계층 비교 + 실세션 로그(`~/.jwc/logs/gjc.2026-06-13.log`) + 동일 머신 WS 핸드셰이크 차등 테스트.
> 관련: [260612_jawcode_fork](../260612_jawcode_fork/100_moc_node_porting.md) (런타임 포팅 — 본 개혁은
> 전송 계층 자매편).

jawcode의 툴콜링 루프는 설계상 네이티브 Codex와 동급의 고속 경로 — WebSocket 유지 +
`previous_response_id` 델타 전송 + 프리웜 + `reasoning.encrypted_content` 리플레이 — 를
**이미 전부 구현하고 있다**. 그런데 런타임에서 WS 핸드셰이크가 자체 수명주기 버그로 실패하고,
실패 1회가 세션 전체를 **조용히** SSE(매 라운드 풀 히스토리 재전송)로 영구 강등시킨다.
"gpt-5.5인데 1.7 tok/s"의 정체는 모델이 아니라 이 강등이다. 개혁의 본질은 새 기능 추가가
아니라 **이미 있는 고속 경로가 실제로 동작하게 만들고, 죽었을 때 보이게 만드는 것**이다.

## 증상

- ① GPT-5.5(high effort, `serviceTier: priority`) 사용 중 푸터 토큰 속도 `⤴ 1.7/s`.
- 푸터 tok/s는 `output_tokens(reasoning 포함) ÷ 턴 전체 시간`이라
  (`packages/coding-agent/src/modes/components/status-line/token-rate.ts:42-66`,
  duration은 `openai-responses.ts:328`에서 요청 전체 벽시계), 낮은 값 = TTFT(프리필+큐)가
  분모를 지배한다는 뜻. 컨텍스트 33.9%/272K(≈92K 토큰) 상태에서 툴 라운드마다 1~2분 소요.
- ② **다음 사용자 메시지 전송 시 첫 응답 토큰까지의 지연이 극단적으로 길다** (턴 경계 TTFT).
  턴 내부 툴 라운드보다 턴 사이 경계에서 더 크게 체감.
- ③ **같은 응답 스트림 안에서 출력 레이트가 중간부터 붕괴** (260613 09:32 라운드, 6분 소요).
  연속 Write 툴콜 중 첫 파일(100.02) args는 5~10초에 완료, 두 번째(100.03) args는 3분+
  거북이 스트리밍. 이후 라운드는 6~15초로 회복. **판정 완료: 클라이언트 O(n²) 렌더 버그**
  — 매 델타마다 완성된 선행 툴콜 컴포넌트까지 전부 재클론·재렌더. 추가 재현("끊고
  재호출하면 다시 빠름")으로 확정. 인과·수리안은
  [10_moc G5](./10_moc_general_improvements.md) 참조. 증상 ①의 주 증폭기였을 가능성 높음.

## 증거 체인

1. **로그**: `~/.jwc/logs/gjc.2026-06-13.log`에 `"Codex websocket prewarm failed"` —
   `WebSocket is closed before the connection is established` 가 하루 5건, 그중 3건이
   **같은 밀리초**(02:40:10.276)에 동시 발생. WS 성공/델타 통계 로그는 0건.
2. **차등 테스트**: 같은 머신·Bun 1.3.14·같은 엔드포인트(`wss://chatgpt.com/backend-api/codex/responses`)·
   jawcode와 동일 헤더(`originator: pi`, `OpenAI-Beta: responses_websockets=2026-02-06` 포함)로
   단독 핸드셰이크 → **성공**. 서버 거절·네트워크·originator 문제가 아니라 jawcode 내부 문제.
3. **코드**: `getOrCreateCodexWebSocketConnection`(`packages/ai/src/providers/openai-codex-responses.ts:2155-2184`)는
   기존 연결이 `isOpen()`일 때만 재사용하고, **CONNECTING 상태면 무조건 `close("reconnect")`**(:2171).
   프리웜(fire-and-forget, `packages/coding-agent/src/sdk.ts:2012-2031`)과 첫 스트림 요청, 또는
   동시 세션 생성이 겹치면 서로의 핸드셰이크 중 소켓을 끊는다. Bun에서 CONNECTING 중 `close()`는
   정확히 위 로그 메시지를 만든다 — "같은 밀리초 3건"과 부합.
4. **강등의 영구성**: 요청 중 WS 실패 시 `recordCodexWebSocketFailure`(:1707-1716)가
   `disableWebsocket = true` — 세션 끝까지 SSE 고정. 폴백 사실은 `PI_CODEX_DEBUG` 없이는
   로그에도 UI에도 안 나온다 (`logCodexDebug` 게이트 :2301-2304).

## 검증 1차 결과 (260613 09:23, `PI_CODEX_DEBUG=1 PI_CODEX_WEBSOCKET=1`)

"tool use 10개해봐" 테스트 세션(pid 60116, 컨텍스트 16%/272K)을 검증 게이트 플래그로 실행한
로그 분석:

- **WS 강제 시 고속 경로 정상 동작 확정**: 모든 툴 라운드가 `[codex] codex websocket request`
  (`requestType: response.create`, retry 0)로 전송. `append reset`/`previous_response_id expired`
  로그 0건. 라운드 간격 2~3초(툴 실행 포함), 푸터 `⤴ 41.7/s`. → **WS+델타가 붙으면
  네이티브급 속도가 나온다.** 1.7 tok/s 증상은 모델이 아니라 전송 경로 문제라는 진단이
  실측으로 확정.
- **`sentTurnStateHeader: false` 전 요청 공통**: 네이티브는 `x-codex-turn-state`를 받아
  스티키 라우팅에 재사용하는데(`codex-rs/core/src/client.rs` OnceLock 캡처), jawcode는 WS
  핸드셰이크 헤더에서만 캡처를 시도하고 실제로는 한 번도 보내지 못함. 서버측 상태
  재사용(=턴 경계 TTFT)에 영향 가능 — P1로 추적.
- **1.7 tok/s였던 원 세션의 transport는 판별 불가**: WS→SSE 폴백 로그가 `logCodexDebug`
  (`PI_CODEX_DEBUG` 게이트, :2301-2304) 뒤에 있어 기본 실행에선 안 찍힘. P0-2(가시성)의
  필요성 재확인.
- **멀티계정 풀 관찰**: 로그에 openai-codex 계정 2개가 번갈아 등장(오전 세션들).
  `auth-storage.ts`는 round-robin 멀티계정 풀을 구현(:640-991, 세션은 sticky). 현재 활성
  계정은 1개지만, 계정 전환 경계에서 `matchesAuth` 불일치 → `close("token-refresh")`(:2168)
  → append 리셋 + **계정별 프롬프트 캐시 전부 미스** 경로가 구조적으로 존재. 멀티계정
  사용 시 턴 경계 TTFT의 잠재 증폭기.

## 검증 2차 결과 (260613 09:27, 대형 컨텍스트 resume, `PI_CODEX_DEBUG=1 PI_CODEX_WEBSOCKET=1`)

원 세션(33%+/272K)을 `jwc --resume 019ebe32-…`로 재개해 라운드 간격을 실측(pid 65502):

| 라운드 | 시각 | 간격 | 해석 |
|---|---|---|---|
| 1 (resume 직후) | 09:27:59 → 09:30:14 | **2분 15초** | 풀 컨텍스트 업로드 + 콜드 프리필 + high 추론 |
| 2 | → 09:30:54 | 39초 | 캐시 워밍 직후 + 추론 |
| 3~5 | → 09:30:58/09:31:03/09:31:06 | **3.3~5.4초** | 델타 정상 동작 (`append reset` 0건) |
| 6~7 | → 09:31:46/09:32:05 | 40초/19초 | 추론 시간 변동 (델타 유지) |

세션 중 `Error: Provider stream stalled while waiting for the next event` 1회 발생 —
**클라이언트측 idle 워치독**(`packages/ai/src/providers/register-builtins.ts:166,211-219`)이
high effort의 무이벤트 구간에서 스트림을 끊고 라운드를 재시작시킴. 지연을 키우는 2차 요인.

**판정**: 대형 컨텍스트에서도 WS+델타는 정상이다. 체감 "존나 느림"은 ① **콜드 스타트
(resume·턴 경계)의 풀 프리필**과 ② **idle 워치독 오발**에 집중돼 있다. 그리고 결정적 격차:
**네이티브 프리웜은 실제 페이로드를 `generate=false`로 미리 보내 서버 프리필까지 끝내는데**
(`codex-rs/core/src/client.rs:15,1401` — "waits for completion"), jawcode 프리웜은 **WS
핸드셰이크만** 연다(`prewarmOpenAICodexResponses`, `openai-codex-responses.ts:1609-1650`).
사용자가 타이핑하는 동안 서버가 컨텍스트를 미리 씹어두는 단계가 통째로 없다 — 증상 ②의
구조적 원인.

## 턴 경계 TTFT (증상 ②) 원인 후보

| 후보 | 근거 | 분류 |
|---|---|---|
| WS idle 5분 타임아웃 → 메시지 사이 대기 후 재연결 | `CODEX_WEBSOCKET_IDLE_TIMEOUT_MS = 300000` (:90) | 구조 |
| 서버측 `previous_response_id` 만료 → 풀 컨텍스트 재전송 | 만료 폴백 존재 (:1371) | 구조 |
| (SSE 폴백 시) 매 메시지 풀 히스토리 + 콜드 프리필 | `store: false` + 캐시 TTL | 구조 |
| codex 경로 `prompt_cache_retention` 미전송 | 타입만 존재(`request-transformer.ts:48`), 설정 안 함. 단 네이티브도 미전송 — 실효 검증 필요 | 검증 필요 |
| high effort 추론이 첫 가시 토큰 전에 선행 | `config.yml :high` | 설정 |
| 메시지 시점 부가 호출(title-generator·usage fetch)이 같은 계정 한도 공유 | 로그 09:23:06.903 (SSE, WS 요청과 동시) | 부차 |

## 네이티브 Codex와의 구조 비교

| 항목 | 네이티브 (codex-rs) | jawcode 설계 | jawcode 실제 런타임 |
|---|---|---|---|
| 전송 | WS 유지 + 프리웜 (`core/src/client.rs:1526-1576`) | 동일 구현 존재 | 핸드셰이크 실패 → SSE |
| 툴 라운드 페이로드 | `previous_response_id` + 델타만 (`core/src/client.rs:1013-1093`) | 델타 구현 존재 (`canAppend`/`deltaRequests`) | 풀 히스토리 (≈92K 토큰) 재전송 |
| 실패 처리 | 재시도 예산 소진 후 세션 폴백 | 1회 실패 = 세션 영구 SSE | 동일, 조용히 |
| 본문 압축 | zstd (`core/src/client.rs:1213-1222`) | 없음 | 없음 |
| reasoning 리플레이 | `include: reasoning.encrypted_content` | 동일 (`openai-responses.ts:753`, codex 경로 `request-transformer.ts:163-166`) | 동작 |
| 프롬프트 캐시 키 | thread_id 고정 | sessionId 고정 (`openai-responses.ts:427-431`) | 동작 |

## 개혁 계획

### P0-1: WS 연결 수명주기 수리 (핵심)

- `openai-codex-responses.ts:2163-2172` — 연결이 CONNECTING이고 auth가 일치하면 close하지
  말고 기존 `#connectPromise`에 **합류(await)** 하도록 변경. `connect()`(:1942-1948)에 이미
  공유 promise가 있으므로 `getOrCreate` 쪽 분기만 고치면 된다.
- 프리웜과 첫 스트림 요청의 동시 connect 직렬화 — 같은 세션 키에 대해 in-flight connect는
  단일화.
- 실패 시 `disableWebsocket` 영구 강등 대신 기존 `PI_CODEX_WEBSOCKET_RETRY_BUDGET`(:231-236)
  예산을 라운드 단위로 소진. 핸드셰이크 1회 실패가 세션 수명 전체를 결정하면 안 된다.

### P0-2: 강등 가시성

- 푸터/모델 세그먼트에 transport 표시(`websocket` / `sse(fallback)`). 데이터는
  `getOpenAICodexTransportDetails`(`provider-details.ts:71-83`)에 이미 전부 있다.
- 폴백 발생 시 1회성 notice (anthropic fast-mode auto-fallback 경고와 같은 패턴,
  `agent-session.ts:6056-6063` 참조).

### P1: 턴 경계 TTFT 단축 (증상 ②)

- **턴 시작 프리커넥트**: 네이티브처럼 매 턴 시작(사용자 입력 수신) 시 WS 재연결을 프리웜.
  현재 프리웜은 세션 생성 1회뿐(`sdk.ts:2003-2032`) — idle 5분 후 첫 메시지는 핸드셰이크를
  인라인으로 지불한다.
- **`x-codex-turn-state` 송수신 수리**: 검증 1차에서 전 요청 `sentTurnStateHeader: false`.
  WS 메시지/응답 이벤트에서도 turn-state를 캡처해 다음 요청에 싣도록 수정.
- **`prompt_cache_retention` 실효 검증**: codex 백엔드가 받는지 확인 후, 받으면 장기 보존
  설정으로 턴 사이 캐시 증발 방지.
- **멀티계정 경계 보호**: 크리덴셜 전환 시 append/캐시 리셋이 불가피함을 인지하고, 전환을
  턴 경계로만 제한 + 전환 사실을 notice로 노출.

### P1: SSE 폴백 경로 자체의 비용 절감

- 요청 본문 압축(네이티브의 zstd 대응) — 폴백 시에도 92K 직렬화 업로드 비용 완화.
- prefix 불안정 요소 정리: 조건부 `"# Juice: 0 !important"` 주입
  (`openai-responses-shared.ts:765-771`)이 reasoning 토글 시 input 배열 구조를 바꿔
  프롬프트 캐시를 깨는 경로 차단.

### P2: 측정 개선

- 푸터 tok/s를 "턴 평균"과 "스트리밍 순간 속도"로 분리하거나 TTFT를 별도 표기 —
  지금 지표는 전송 문제와 모델 속도를 구분 못 해 이번 같은 오진단을 유도한다.

## 검증 게이트

```bash
# 수리 전 베이스라인 / 수리 후 비교
PI_CODEX_DEBUG=1 PI_CODEX_WEBSOCKET=1 jwc
# 기대: prewarm 성공, lastTransport=websocket, deltaRequests > 0,
#       동일 작업에서 라운드당 TTFT 체감 감소
```

- `getOpenAICodexWebSocketDebugStats`의 `fullContextRequests` 대비 `deltaRequests` 비율이
  툴 루프에서 역전(델타 우세)되는지 확인.
- 동시 세션 N개 생성 시 prewarm 실패 0건 (현재 재현 조건).

1차 실행(260613 09:23, 소형 컨텍스트) 결과는 위 "검증 1차 결과" 절 참조 — WS 경로 정상,
41.7 tok/s. **남은 검증**: ① 대형 컨텍스트(30%+)에서 동일 플래그로 툴 루프 + 턴 경계 TTFT
재측정, ② 플래그 없는 기본 실행에서 같은 작업 비교(폴백 재현), ③ idle 5분 초과 후 다음
메시지 TTFT 측정.

## 비고 — 모델 설정 측 완화 (코드와 무관)

- `~/.jwc/agent/config.yml`의 `default: openai-codex/gpt-5.5:high`는 사용자 설정.
  문서/단순 편집 작업은 `:medium` 이하로 내리면 WS와 무관하게 라운드당 추론 지연 감소.
- `serviceTier: priority`(⚡)는 구독(sub) 백엔드에서 실효가 불확실 — 전송 계층이 진짜 병목.
