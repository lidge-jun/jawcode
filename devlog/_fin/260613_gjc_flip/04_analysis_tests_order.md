# 04 — 분석 A4: 테스트/체크 표면 + 실행 순서 (Sonnet 파견, 260613 밤)

## 규모

| 구역 | gjc occurrence |
|---|---|
| packages/*/src | 799 |
| packages/*/test | 847 (193파일; 파일명 gjc 12 + test/gjc-runtime/ 27파일) |
| scripts/ + 루트 package.json | 218 |

픽스처: `test/fixtures/gjc-state/{v1,v2}` (8개 테스트가 소비) · `test/fixtures/gjc-plugins/` (10개 테스트 소비).

## 계약 단언 (보상 없이 못 바꾸는 것) vs 부수 명명

- **계약**: receipt owner enum 단언(state-receipts·state-schema·state-integrity·ultragoal-runtime·workflow-state-command), hermes config(`setup-cli`), MCP 서버/도구명(coordinator-mcp*), `embedded:gjc/` 경로(default-gjc-definitions·input-controller-skill-queue·sdk-skills), stop-reason 코드(`gjc-target`·`gjc_skill_*`·`gjc_tmux_session_not_found`), hindsight `"gjc"` 뱅크, HTML export `gjc-share:v1:*`, update-cli의 릴리즈 artifact `gjc-linux-x64`.
- **부수**: mkdtemp prefix·describe 라벨 — 자유 리네임.

## 체크 인프라

- `check:gjc-ui` = `verify-gjc-ui-redesign.ts`(ENGINE_NAME 조건식·HTML export 리터럴·README 게이트) + `rebrand-inventory.ts --strict`(`@gajae-code/` 스코프·루트명 `gajae-code`·bins `["gjc","gjc-stats","jwc"]`·`defaults/gjc/skills` 경로 스캔).
- `check:schemas` = config.schema.json (`$id: gajae.ai`, `title: GJC config.yml`).
- CI: `.github/workflows/ci.yml` 17곳 — job명 `gjc-state-gates`(브랜치 보호 연동), 바이너리 artifact `gjc-<os>-<arch>`, `scripts/ci-gjc-state-gates.ts`.
- scripts/ gjc 파일 6종 (ci-gjc-state-gates·generate-gjc-skill-command-refs·generate-gjc-workflow-manifest·verify-gjc-skill-docs·verify-gjc-state-writers·verify-gjc-ui-redesign).

## 순환 위험

1. `embedded:gjc/` — 생성(gjc-defaults.ts:126)과 단언(테스트 3종)을 **같은 커밋**에서.
2. receipt owner — 마이그레이션/enum 확장 먼저, 그 다음 쓰기 플립+테스트.
3. `check:gjc-ui`가 `check:ts` 파이프라인의 일부 — ENGINE_NAME·defaults 경로 건드는 단계는 스크립트 동시 갱신.
4. `rebrand-inventory.ts`의 `defaults/gjc/skills` 경로 스캔 — F2와 동시 갱신.

## 제안 순서 (파견 원문 요지)

F-early(순수 심볼) → F-mid.1(gjc-runtime→jwc-runtime) → F-mid.2(gjc-plugins→jwc-plugins) → F-mid.3(defaults/gjc→defaults/jwc + embedded: + rebrand-inventory + 테스트 단언) → F-late(퍼시스트 계약: owner enum read-both→write플립→마이그레이션 / MCP·stop-reason·hindsight·HTML은 호환 심 필요) → F-last(픽스처·테스트 파일명·scripts·CI job명+브랜치보호·ENGINE_NAME 최후).

각 단계 게이트: `check:types` + 해당 패키지 테스트 + (경로 건드린 단계는) `check:gjc-ui`.
