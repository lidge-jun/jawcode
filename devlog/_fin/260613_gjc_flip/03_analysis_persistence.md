# 03 — 분석 A3: 퍼시스턴스·호환 계약 (Sonnet 파견, 260613 밤)

> 원문 요약 — 전체 사이트 목록은 파견 결과 기준. 핵심만 수록.

## 1. receipt.owner — 3값 enum 퍼시스트 계약

- 타입: `workflow-state-contract.ts:13` `"gjc-state-cli" | "gjc-runtime" | "gjc-hook"`.
- 읽기 검증: `state-schema.ts:39` zod enum (+`orchestrate-state.ts:163` 복제), `state-migrations.ts:80`(불일치 시 gjc-state-cli로 리셋), `active-state.ts:184`(불일치 receipt 무음 드랍 → HUD 소실).
- 쓰기: state-runtime(14곳)·team(3)·ralplan(9)·jaw-interview(6)·ultragoal(3)·goal-mode-request(2)·state-writer(4)·orchestrate-state(1)·active-state(2).
- **블라인드 플립 = 기존 상태 읽기 전부 fail-closed.** 처방: **read-both(enum 확장) → write-new → (후행) 마이그레이션 v3 + enum 축소**.

## 2. 상태 필드

- `gjcGoalMode`/`gjcObjective`/`gjcObjectiveAliases` — `.jwc/ultragoal/goals.json` 퍼시스트. `normalizePlan()`에 `jwc* ?? gjc*` 폴백 추가로 안전 플립 가능.
- receipt.command "gjc state …" 문자열: 검증 안 됨(informational) — 단 **실 바이너리는 jwc라 현 문자열이 라이브 버그** (doctor 안내·SKILL cmdref가 `gjc state …` 지시). 플립 = 버그픽스.
- `workflow-command-ref.ts:53,64` CLI verb `"gjc"` → 플립 + cmdref 재생성.

## 3. 설정 키

- `gjc.deepInterview.ambiguityThreshold` → **이미 마이그레이션 완료** (settings.ts:633 자동 이행).
- `hindsight.retainContext` 기본 `"gjc"` + `DEFAULT_BANK_NAME="gjc"` → **기억 뱅크 키. 플립 금지(연기)**.

## 4. env GJC_* (40여종 인벤토리)

- `packages/utils/src/env.ts:185` JWC→GJC 미러 + `$resolveEnv` 인프라 기존재. 일부 직독 사이트(`process.env.GJC_SESSION_ID` 등) 갭.
- GJC_TEAM_*/GJC_COORDINATOR_*/GJC_HARNESS_*는 JWC 별칭 없음 — **string 값 플립 연기**, TS 상수명만 F1에서 플립.

## 5. CLI/IPC

- `jwc gjc …` 톱레벨 서브커맨드 없음 (registered names는 "state"/"ralplan" 등).
- ACP `_gjc/` extMethod 6종 — 외부 호출자 리포 내 부재 → **accept-both 별칭 추가가 안전**.
- tmux `@gjc-*` 옵션·`gajae_code_*` 세션명·hermes `gjc_coordinator`·harness `gjc-session/`·HTML export `gjc-share:v1:*` → **전부 연기 목록** (read-both/migrate-once 설계 §체크리스트 참조).

## 6. 마이그레이션 체크리스트 (의존 순서, 파견 원문)

Phase 0 read-shim 9건 → Phase 1 one-time 마이그레이션 3건 → Phase 2 write 플립 11건 → Phase 3 클린업. (상세는 본 분석 파견 로그 — 05 플랜이 오늘밤 실행분/연기분을 가른다.)
