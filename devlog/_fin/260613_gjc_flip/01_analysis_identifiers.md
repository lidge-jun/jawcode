# 01 — 분석 A1: 식별자·심볼·경로 인벤토리 (Sonnet 파견, 260613 밤)

> 범위 실측: **3,788 occurrences / 482 TS 파일** (packages 464 + scripts 16) + JSON 스키마·루트 package.json·Dockerfile.

## 위험 분류 요약

| 클래스 | 내용 | 전략 |
|---|---|---|
| MECHANICAL | 내부 심볼·타입(Gjc*)·로컬 함수·주석 | 워드바운더리 일괄 치환, tsc 검증 |
| PATH/DIR | `src/gjc-runtime/` · `src/extensibility/gjc-plugins/` · `src/defaults/gjc/` · `gjc-defaults.ts` · `test/gjc-runtime/` · `test/fixtures/gjc-*` | 디렉터리별 원자적 이동+임포트 갱신 |
| BRAND-LOGIC | ENGINE_NAME/APP_NAME/isJawBrand 이중 브랜드 분기 | **동결** (플립 시 게이트 반전) |
| PERSISTED-CONTRACT | receipt.owner · 상태 필드 · GJC_* env · MCP 이름 · tmux 옵션 | read-both 심 + 단계적 |
| EXTERNAL-SURFACE | CLI bin·config 스키마·README·Dockerfile.robogjc·check:gjc-ui | 후행 |

## TOP-5 런타임 리스크 (tsc 통과해도 깨지는 것)

1. **`ENGINE_NAME = "gjc"`** (`packages/utils/src/dirs.ts`) — `isJawBrand()`(`discovery/helpers.ts:36`)의 분모. 플립 시 **jaw-브랜드 게이트 전부 무음 반전**.
2. **`WorkflowStateMutationOwner`** (`skill-state/workflow-state-contract.ts:13`) — 디스크 퍼시스트 유니온. 블라인드 리네임 = 기존 `.jwc/state/*.json` 읽기 파탄.
3. **coordinator MCP**: `gjc_coordinator_*` 도구 13종 + `"gjc-coordinator-mcp"` 서버명 — 사용자 MCP config에 기록됨 (`gjc setup hermes`).
4. **tmux 옵션** `@gjc-profile`/`@gjc-branch`/`@gjc-branch-slug`/`@gjc-project` (`gjc-runtime/tmux-common.ts`) — 실행 중 세션이 구 이름 보유.
5. **`DEFAULT_BANK_NAME = "gjc"`** (`hindsight/bank.ts:25`) — 클라우드 메모리 뱅크 키. 무마이그레이션 리네임 = 기억 전손.
