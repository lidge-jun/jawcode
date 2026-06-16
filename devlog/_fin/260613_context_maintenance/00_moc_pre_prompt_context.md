# 00 — MOC: Pre-Prompt Context Maintenance 이식 (#542 + #570)

> 상태: **전 Phase 완료 ✅** (260613)
> Phase 1 (#542 pre-prompt check) ✅ / Phase 2a (tool-choice infra) ✅ /
> Phase 2b (#570 estimator split + dedup + bypass fix) ✅ /
> Phase 2c (monitor truncation) ✅ / Phase 2d (tests, 3 skip) ✅
> upstream: gjc dev `534b4f0` (#542) + `8e8e784` (#570)
> MLB 격차: JWC 55 vs GJC 65 — context 관리 도메인 최대 단일 갭
> 난이도: **대** — `agent-session.ts`는 jawcode HARD-EDIT 최다 파일

## 왜 하는가

현재 jwc는 **post-turn compaction만** 있어서 컨텍스트 overflow를 턴 종료 후에야 감지·수습.
upstream #542가 **pre-prompt check**(보내기 전 추정·선행 압축)를 추가했고, #570이 agent-
initiated 내부 턴(task notification·monitor)의 우회를 막음 + display/compaction 추정 분리.

이게 없으면:
- 긴 세션에서 갑작 context overflow 에러 또는 응답 잘림
- compaction이 뒤늦게 돌아 1턴 낭비 (사용자 입력 실패 → 압축 → 재시도)
- monitor/notification 대량 출력이 단독으로 overflow 유발 가능

## 이식 범위

### Phase 1 — #542 (pre-prompt check 기반)

| 파일 | 변경 | 난이도 |
|---|---|---|
| `agent-session.ts` | `#checkEstimatedContextBeforePrompt` 메서드 추가 + `#promptWithMessage`에서 호출 | **중** — 삽입점 찾기가 핵심 |
| `compaction/compaction.ts` | `shouldCompact` export 추가 (이미 10.013으로 파일 수정됨) | 소 |
| `test/compaction.test.ts` | 테스트 확장 | 소 |
| `test/agent-session-auto-compaction-queue.test.ts` | 신규 테스트 | 소 |

### Phase 2 — #570 (우회 방지 + estimator 분리)

| 파일 | 변경 | 난이도 |
|---|---|---|
| `agent-session.ts` | `sendCustomMessage` 경로를 `#promptWithMessage`로 전환 + `#estimateContextTokens` 분리(display heuristic vs native) + 새 필드/타입 추가 | **대** |
| `tools/monitor.ts` | notification 라인 절단 (`truncateTail`) | 소 (독립) |
| `test/monitor-cron-tools.test.ts` | 신규 테스트 케이스 | 소 |

### 선행 의존

| 의존 | 상태 |
|---|---|
| `estimateMessageTokensHeuristic` (compaction export) | ✅ **10.013으로 이미 포팅** |
| `estimateTextTokensHeuristic` | ✅ **10.013으로 이미 포팅** |
| `buildNamedToolChoiceResult` (utils/tool-choice) | ⬜ 포팅 필요 |
| `cloneJsonValueForForkSeed` (새 헬퍼) | ⬜ 인라인 추가 |

## 구현 전략 (Sonnet 조사 후 확정)

> 3명 병렬 조사 결과(hunk 매핑 + 의존 분석 + 삽입점 스캔)로 아래를 확정:
> 1. Phase 1 먼저 (#542 단독 — 선행 방어만)
> 2. 테스트 통과 + 라이브 검증
> 3. Phase 2 (#570 — 우회 방지 + estimator 분리)
> 4. 전체 테스트 + 라이브 검증

## 위험

- `agent-session.ts`에 reformation 패치(프리웜·transport·fallback notice)가 있어 인접 충돌
- `#estimateContextTokens` 분리 시 기존 compaction 호출 경로 회귀 위험
- display 경로에 native 토크나이저 호출이 남으면 RSS/CPU 오버헤드

## 검증 게이트

```bash
bunx tsgo --noEmit -p packages/coding-agent/tsconfig.json
bun test packages/coding-agent/test/compaction.test.ts
bun test packages/coding-agent/test/agent-session-auto-compaction-queue.test.ts
bun test packages/coding-agent/test/monitor-cron-tools.test.ts
# 라이브: 30%+ 컨텍스트 세션에서 compaction 선행 발동 확인
```

## 세부 문서 (조사 완료 시 추가)

- `01_hunk_map_542.md` — #542 hunk별 jawcode 대응 표
- `02_hunk_map_570.md` — #570 hunk별 + 의존 체크리스트
- `03_insertion_guide.md` — jawcode agent-session.ts 삽입점 지도

*작성: 260613. Sonnet 3병렬 조사 완료 후 세부 문서 생성·구현 착수.*
