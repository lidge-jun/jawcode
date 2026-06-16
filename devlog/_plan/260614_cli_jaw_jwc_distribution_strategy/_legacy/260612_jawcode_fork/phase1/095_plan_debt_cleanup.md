# 095 — 부채 해소 플랜 (하드 수정 전환 + 미커밋 혼재 + 가드/문서 정합)

> 입력: 사용자 "지금까지 이어져 왔던 부채를 해결하는 플랜" (260612 02:11). 전수 감사: Backend 직원 read-only (260612 02:1x, HEAD `efb3d290`).
> 배경: 인터뷰 02:04 확정 — 소스 하드 수정 원칙 전환([085.5](./085.5_plan_prompt_rebrand.md) 개정판)으로 구원칙(diff-0·런타임 치환·gjc 무회귀) 기반 코드·테스트·문서가 부채화. 별도로 dirty tree에 3개 워크스트림 혼재 + biome 레드.

## 0. 부채 인벤토리 (감사 결과 요약 — 전수는 감사 보고 원문)

| 분류 | 규모 | 핵심 |
|------|------|------|
| **D1 미커밋 혼재** | 수정 22 + 미추적 5 파일, 3개 워크스트림(086 비주얼 / 094.3 로컬토큰 / 094.4 quota / 085.5-M6 부분) | 단일 커밋 부적합 — 분리 커밋 필요. 086 테마 JSON 2종·094.3 `local-token-detect.ts`는 미추적이라 빌드 의존 깨짐 상태 |
| **D2 biome 레드** | error 16 · warning 3 (check:tools에서 check:ts 차단) | 선행 차단: **커밋된** kiro provider 9건+format. 미커밋 연동 6건(welcome/controllers/theme/registry/local-token-detect) |
| **D3 구원칙 코드·테스트** | 가드/테스트 ~10파일 깨질 예정, 기능 버그 3지점 미착수 | `default-gjc-definitions.test.ts`(214·319-371)·`bash-allowed-prefixes`·`bash-interceptor`·`agent-fields`·`state-handoff-thrift`·`gjc-dogfood-template`·`verify-g002-gates.ts`·`rebrand-inventory.ts` = M5 반전 대상. 유지: `skills-discovery-jaw`·`cli-command-surface`·`brand-visual-identity`·TUI/tool byte 스냅샷(브랜드 무관) |
| **D4 문서 부채** | devlog 구플랜 20+파일 + `README.jwc.md:7-8` + `structure/gitstructure.md:45-46` + 코드 주석 4곳 + `struct_har/` 27+파일 | "무수정 추종·diff-0·무회귀·런타임 치환"을 현행처럼 서술 |

브랜드 분기(`isJawBrand`/`GJC_BRAND_NAME`) 자체는 대부분 **유지 대상**(기능 게이트: jaw 전용 CLI/slash·스킬 디스커버리·TUI 비주얼·APP_NAME 표시) — 폐기되는 역할은 "gjc 산문 보존·byte-동일 assert"뿐.

## 1. 해소 웨이브

| W | 작업 | 내용 | 게이트 |
|---|------|------|--------|
| **W1** | biome 그린 | 커밋된 kiro 9건+format → 단독 커밋. 미커밋 연동 6건은 W2 각 커밋에 포함 | `bun run check:ts` exit 0 |
| **W2** | 미커밋 분리 커밋 | ① 094.3 로컬토큰(+`local-token-detect.ts` 추적) ② 094.4 quota ③ 086 비주얼(+테마 JSON 2종, `brand-visual-identity.test.ts`) ④ 084 모델셀렉터 테스트 ⑤ 085.5-M6 부분(commands 3종 — [열린 질문 3] 답대로 재작업 여부) | 워크스트림당 1커밋, 각 테스트 green |
| **W3** | 085.5 M1→M2+M5→M3→M4→M6 **+ M7(gjc bin 제거)** | 기능 버그 → 하드 수정+가드 반전 → 조립 코드 → 번들 스킬 → commands 잔여 → **gjc 진입 표면 제거(§2-#1 파급 포함)** | 085.5 §3 테스트 표 + `jwc --version` 스모크 (gjc 스모크 폐기) |
| **W4** | 문서·주석 정합 | devlog 구플랜에 "[구원칙 — 02:04 개정으로 폐기]" 헤더 배너 일괄(파일별 본문 재작성은 안 함 — 역사 기록 보존), `README.jwc.md` 관계 절 개정, `structure/gitstructure.md` 게이트 목록 갱신, 코드 주석 4곳(cli.ts:56 등), `struct_har/` 처리([열린 질문 6]) | grep "무수정 추종\|diff-0" 현행 서술 0 (배너 처리 제외) |

W1·W2는 085.5 본 작업(W3)과 독립 — 즉시 착수 가능. W3가 W4의 선행(가드 반전 후 문서가 사실과 일치).

## 2. [확정] 사용자 결정 7건 (인터뷰 260612 02:17)

| # | 쟁점 | 확정 |
|---|------|------|
| 1 | **gjc bin 운명** | **제거** [사용자: "나중에 bun으로 gjc 따로 깔면 됨 — 그 수준으로 클린하게"] — gjc 진입 표면(`packages/gajae-code/bin/gjc.js` + package.json `bin` 등록) 레포에서 제거, jwc 단일 진입점. 필요 시 업스트림 npm `gajae-code` 별도 설치. 엔진 코드(`@gajae-code/coding-agent` 등)는 유지 — `packages/gajae-code` 셸 패키지 전체 제거 여부는 W3-M7 구현 시 의존 확인 후 |
| 2 | identity diff-0 불변식(`system-prompt-identity.test.ts:63`) | **재정의** — "미설정 시 하드-수정된 baseline과 동일"로 테스트 패턴 유지 |
| 3 | M6 예시 | **`${APP_NAME}` 동적 유지** — 이미 구현된 미커밋 3건 활용 (jwc 실행 출력은 리터럴과 동일) |
| 4 | 브랜드 게이트(isJawBrand 등) | **전부 유지** — 기능 게이트는 산문 정체성과 무관 (gjc bin 제거 후 사실상 상시 jaw지만 env 게이트 구조 보존) |
| 5 | G002/rebrand-inventory 계약 | jwc 어휘 기준 **반전** + gjc bin 표면 검증 항목 **폐기** (#1 제거와 정합) |
| 6 | `struct_har/` 27+파일 | W3 완료 후 **재생성** (자동 생성 스냅샷 — 수기 수정 금지) |
| 7 | 병렬성 | **병렬 허용** — W1·W2 선행 후 W3와 086/094 TUI 잔여 작업 병렬 |

**#1 파급 (W3에 M7 추가)**: gjc bin 제거 시 — `test/brand-visual-identity.test.ts`(086 미추적)의 gjc 브랜드 probe 케이스 제거/축소, `gjc-dogfood-template` 등 gjc 표면 스모크 정리, 085.5 M1 allowlist는 **jwc 단독 접두로 단순화 가능**(gjc 접두 인정 불요), 021 검증 항목의 `gjc --version` 스모크 폐기. `Dockerfile.robogjc`·`python/robogjc`는 별개 시스템 — 무관.

## 3. 완료 기준

1. `bun run check:ts` exit 0 (W1·W2 직후 시점부터 유지)
2. `git status` clean — 워크스트림별 분리 커밋 완료
3. 085.5 §3 테스트 표 green (M5 반전 가드 포함)
4. 구원칙 현행 서술 0 — devlog 배너·README.jwc·structure·코드 주석 처리 완료
5. jwc TUI "너는 누구야" e2e — Jaw 정체성, GJC 비언급
