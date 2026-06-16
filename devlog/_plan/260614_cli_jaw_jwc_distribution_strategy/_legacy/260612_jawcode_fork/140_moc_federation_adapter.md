# 140 MOC — Federation 검색 어댑터 (후순위)

> 상태: ⬜. 결정 근거: D9 [확정] — jwc 세션을 dashboard chat search에 노출. M2 done 이후 안정화 밴드.
> **260613 플립 기준 재구체화 (gjc→jwc flip 반영)** — 앵커 재검증 + 단계·AC 구체화. 엔진 세션
> 어휘를 jwc로 통일 (구 "gjc 세션" = jwc 엔진 세션).

## 코드 사실 (04 로그 R3 조사 승계 — 260613 재검증)

- cli-jaw L2: `src/manager/memory/chat-federation.ts` `searchChatFederated()` —
  인스턴스별 jaw.db를 readonly로 열어 `messages.content` LIKE 스캔.
  `probeSchema()`가 messages 테이블 없으면 schema_mismatch로 스킵 → **jwc 엔진 세션 db는 현재 비가시**.
  ※ cli-jaw 측 앵커는 cli-jaw 체크아웃 기준 — 착수 시 재실측 (본 리포 밖).
- jwc 엔진 세션: `history` 테이블 + `history_fts` FTS5 — **재검증 ✅**
  `packages/coding-agent/src/session/history-storage.ts:83` (FTS 존재 감지) ·
  `:98` `CREATE VIRTUAL TABLE history_fts USING fts5(prompt, content='history', …)`.
  검색 인프라는 jwc 쪽이 우월 (FTS5 vs LIKE 풀스캔).
- cli-jaw L1/L2의 LIKE 풀스캔 → FTS5 전환은 **별도 프로젝트** (jawcode 범위 밖 [확정 D9]).
- 상태/세션 경로: 플립·마이그레이션 완료로 **`.jwc/` 단일** (구 `.gjc/`는 migrate-config-dir
  원타임 rename — 수집 범위 질문에서 legacy 경로 고려 불요).

## 구현 단계 (구체화)

| 단계 | 내용 | 앵커 | AC |
|---|---|---|---|
| FA1 | `probeSchema` 확장: jwc `history` 스키마 감지 → 전용 쿼리 경로 (`history_fts MATCH` 우선, 부재 시 LIKE 폴백) | cli-jaw `chat-federation.ts` + jwc `history-storage.ts:83-98` 스키마 계약 | jwc db에 schema_mismatch 0 |
| FA2 | 결과 매핑: history 행 → `ChatSearchHit` — instanceId [기본값] `jwc:<agentDir basename>` 의사 인스턴스 | ChatSearchHit 타입 (cli-jaw) | 출처 표기 포함 히트 반환 |
| FA3 | 등록 경로: dashboard instances 레지스트리에 jwc 세션 db 경로 옵트인 등록 (`cli-jaw dashboard memory instances` 표면 재사용) | cli-jaw dashboard | 미등록 시 무회귀 |
| FA4 | 대량 가드: LIMIT/days 필터를 FTS 쿼리에 위임 + 10만+ 메시지 합성 p95 측정 기록 | FTS MATCH + rowid 범위 | p95 수치 문서화 |

## 완료 기준

- `cli-jaw dashboard chat search "<q>"`가 jwc 단독 세션 히트 반환 (출처 표시 포함)
- 10만+ 메시지 합성 데이터에서 검색 p95 측정·기록 (FTS 경로 검증)
- 미등록 시 기존 동작 무회귀 (옵트인)

## 플립 연기 항목 교차 (착수 시 확인)

- 본 밴드 직접 영향 없음 — db 스키마(`history`/`history_fts`)와 `.jwc/` 경로는 플립 무관 안정.
- federation이 receipt/state 파일을 읽게 확장된다면 owner read-both 규약
  (`workflow-state-contract.ts` `normalizeWorkflowStateOwner`) 준수.

## 열린 질문 [확정 대기]

- jwc 세션 db가 여러 프로젝트에 흩어질 때(워크트리별 `.jwc/`) 수집 범위 — [기본값] 홈 레벨만 1차
- 양방향(메모리 federation까지)은 후속 — 070 포맷 호환이 전제 ([phase1/070_moc_memory.md](./phase1/070_moc_memory.md))

## 세부 실행 문서 (260613 구체화)

- [140.1_plan_chat_federation_adapter.md](./140.1_plan_chat_federation_adapter.md) — history_fts 실측 기반 FA-1~3 (probeSchema 확장·Hit 매핑·p95)
