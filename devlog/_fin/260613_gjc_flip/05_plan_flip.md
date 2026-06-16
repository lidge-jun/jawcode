# 05 — 확정 플랜: gjc→jwc 소스 플립 (260613 밤 실행)

> 상태: ✅ 확정 (A1~A4 분석 종합) — 본 문서 기준으로 F1~F6 야간 실행.
> 원칙: ① 각 단계 후 `check:types` + 해당 테스트 green ② 퍼시스트 계약은 read-both 선행
> ③ 외부/데이터-손실 계약은 연기 명단으로 (블라인드 플립 금지) ④ 커밋 없음 (사용자 미승인 —
> 워킹트리 작업, 아침 보고 후 사용자 판단).

## 결정 사항 (분석 근거)

| # | 결정 | 근거 |
|---|---|---|
| D1 | `@gajae-code` 스코프 **유지** (063.1 전략 B 존속) | A2 — 스코프는 upstream 소유, 퍼블리시 불가. 내부 전용 625파일 churn은 무효용 |
| D2 | `ENGINE_NAME="gjc"` + 이중 브랜드 기계 **동결** | A1 리스크 1 — 플립 시 isJawBrand 전 게이트 무음 반전. 브랜드 은퇴는 별도 제품 결정 |
| D3 | receipt.owner는 **read-both → write-new + 마이그레이션 v3** | A3 §1 — 기존 .jwc/state 호환 |
| D4 | env GJC_* **문자열 값 동결** (TS 심볼명만 플립) | A3 §4 — JWC→GJC 미러 인프라 기존재, 값 플립은 spawn 사이트 전수 필요 |
| D5 | `"gjc state …"` CLI 문구·cmdref verb는 **플립 = 버그픽스** | A3 §2/§5 — 실 바이너리는 jwc, 현 문구가 라이브 버그 |
| D6 | 데이터-손실·외부 계약 **연기** (아래 명단) | A1 TOP-5 · A3 — 마이그레이션 설계 필요 |

## 실행 단계

- **F1 디렉터리 플립** (원자, 디렉터리별): `src/gjc-runtime/`→`jwc-runtime/` ·
  `src/extensibility/gjc-plugins/`→`jwc-plugins/` · `src/defaults/gjc/`→`defaults/jwc/` +
  `gjc-defaults.ts`→`jwc-defaults.ts` + `embedded:gjc/`→`embedded:jwc/` + 전체 임포트 갱신 +
  `rebrand-inventory.ts` 경로 + 테스트 단언 3종 + `test/gjc-runtime/`→`test/jwc-runtime/`.
  게이트: tsc + 관련 스위트.
- **F2 심볼 리네임**: `Gjc`→`Jwc` 식별자 일괄 (camel 경계 — 문자열 충돌 사전 검사) +
  SCREAMING 상수 선별 리스트 (CANONICAL_GJC_WORKFLOW_SKILLS 등 — env 값 보유 상수 제외).
  게이트: tsc + brand/identity 스위트.
- **F3 receipt/CLI 문구 계약**: owner enum read-both(gjc-*|jwc-*) → 쓰기 jwc-* 플립 →
  마이그레이션 v3 → normalize 사이트 3곳 → 테스트·픽스처 갱신. + receipt.command/doctor/
  cmdref verb `gjc `→`jwc ` + cmdref 재생성 스크립트 실행.
- **F4 런타임 코드값**: stop-reason/error 코드(`gjc-target`·`gjc_skill_*`·`gjc_tmux_session_not_found`
  — 비퍼시스트, 호출자 일회 소비) 플립 + ACP `_jwc/` 별칭 추가(`_gjc/` 유지) + worker/rpc/launch
  기본 커맨드 `"gjc"`→`"jwc"` (A3 §7 — 실 바이너리 정합).
- **F5 테스트/스크립트 인프라**: 테스트 파일명 gjc-*→jwc-* · 픽스처 `gjc-state/`→`jwc-state/`,
  `gjc-plugins/`→`jwc-plugins/` · scripts 6종 리네임 · `check:gjc-ui`→`check:jwc-ui` ·
  yml의 스크립트 경로 갱신 (job명·artifact명은 연기).
- **F6 전체 검증**: 전 패키지 tsc · coding-agent/tui/utils/ai 전체 테스트 · biome ·
  `check:jwc-ui` · rebrand-inventory · 결과를 06 로그에.

## 연기 명단 (F-late2 마일스톤 — 본 플립에서 의도적으로 제외)

ENGINE_NAME·이중 브랜드(D2) / `@gajae-code` 스코프(D1) / hindsight 뱅크 `"gjc"`(기억 전손 위험) /
coordinator MCP `gjc_coordinator_*`·hermes managed-by(사용자 config 마이그레이션 필요) /
tmux `@gjc-*` 옵션·`gajae_code_*` 세션명(실행 중 세션) / env GJC_* 문자열 값(D4) /
HTML export `gjc-share:v1:*`(기존 export 파일) / CI job명 `gjc-state-gates`(브랜치 보호)·
릴리즈 artifact `gjc-<os>-<arch>`·bins `gjc`/`gjc-stats`(설치 호환) / Dockerfile·robogjc /
harness `gjc-session/` 디렉터리(라이브 세션).
