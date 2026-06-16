# 096 — 잔여 패치 완결 실행 플랜 (goal 1ff15596-5fd · P 산출물 v2)

> 목표: 055~059·085번대 잔여 패치 + 프롬프팅 작업 완결 → 060번대 돌입 준비 (클린 시 060 구현 착수).
> 모듈 정본: [095](./095_plan_debt_cleanup.md)(W1-W4·확정 7건) · [085.5](./085.5_plan_prompt_rebrand.md)(M1-M7) · [085.6](./085.6_plan_identity_leak_zero.md)(M1·M3·M4) · [057](./057_plan_skill_compat_patch.md)(M1-M2·§6 P10) · [061](./061_design_goal_merge.md)(060 M1-M7, 조건부).
> v2: A 감사 FAIL 5건 반영 (260612 02:2x, Backend) — **M5 가드 반전 이원화(M5a/M5b)**, W2에 ultragoal-runtime 배정, C10 파급 체크리스트, C8 M3 전수, 앵커 전체 경로.

## 커밋 단위 (C1~C12)

| C | 내용 | 정본 | 게이트 |
|---|------|------|--------|
| C1 | **W1 biome 그린** — 커밋된 lint 전수: `packages/ai/src/providers/kiro.ts`(9건+format), `provider-models/descriptors.ts:222`, `providers/register-builtins.ts`, `utils/oauth/kiro.ts:45`, `coding-agent/src/modes/components/tool-transcript-overlay.ts`, `controllers/event-controller.ts:345`, `controllers/input-controller.ts:1` | 095 W1 | `bun run check:tools` green |
| C2 | **W2-① 094.3 로컬토큰** — `packages/ai/src/auth-storage.ts`, `utils/oauth/{anthropic,openai-codex,xai}.ts` + 미추적 `utils/oauth/local-token-detect.ts` 추적(organizeImports 수정 포함) | 095 D1 | 빌드 의존 해소, 관련 테스트 green |
| C3 | **W2-② 094.4 quota** — `modes/controllers/{command,selector}-controller.ts`, `modes/interactive-mode.ts`, `modes/types.ts`, `slash-commands/builtin-registry.ts`, `slash-commands/helpers/usage-report.ts` (format/organizeImports 포함) | 095 D1 | check:tools green 유지 |
| C4 | **W2-③ 086 비주얼** — `modes/components/welcome.ts`, `modes/theme/theme.ts`, `theme/defaults/index.ts` + 미추적 `abyss-bite{,-light}.json`·`test/brand-visual-identity.test.ts`, `config/settings-schema.ts`(테마 default), `test/{gjc-ui-redesign,modes/components/theme-selector-input}.test.ts`, `scripts/verify-gjc-ui-redesign.ts` | 095 D1 | 086 테스트 green |
| C5 | **W2-④ 084 모델셀렉터 + ⑤ 085.5-M6 부분 + ⑥ 082.1 IME** — ④ `modes/components/model-selector.ts` + 미추적 `test/model-selector-provider-tabs.test.ts` / ⑤ `commands/{ralplan,state,ultragoal}.ts` + `gjc-runtime/ultragoal-runtime.ts`(`${APP_NAME}` 동적 — 감사 이슈#2 배정) / ⑥ `modes/components/custom-editor.ts` + `test/custom-editor-keybindings.test.ts`(082.1 한글 IME Ctrl-chord 감지 — 재감사 발견) — 3커밋 | 095 D1·#3 동적 확정·082.1 | **`git status` clean** + `bun run check:ts` exit 0 |
| C6 | **085.5 M1** — `packages/coding-agent/src/tools/bash-allowed-prefixes.ts:122` jwc 접두 전환, `src/skill-state/jaw-interview-mutation-guard.ts:254`, `prompts/agents/{planner,architect,critic}.md` frontmatter `jwc ralplan --write`/`jwc state` + 관련 테스트(`test/tools/bash-allowed-prefixes`·`bash-interceptor`·`test/discovery/agent-fields`) 동행 갱신 | 085.5 M1 | 갱신 테스트 green (default-gjc-definitions `:214`는 본 커밋에서 jwc 기대로 동행 반전) |
| C7 | **085.5 M2 + M5a** — `prompts/system/system-prompt.md`(L1·3·21·23-42·83·225·275 하드: "You are Jaw, the coding agent running on the jwc runtime (Jawcode)."·`<jawcode-system-prompt>`), `prompts/tools/bash.md:20`·`skill.md:11-12`·recall/reflect/retain + **가드 반전은 system/tools/role-agent 분만**(M5a). ⛔ 번들 본문 가드(`test/default-gjc-definitions.test.ts:319-371`)·gjc-dogfood는 **건드리지 않음**(각 C9·C10) | 085.5 M2·M5 분할 | M5a 반전 가드 green + jwc 시스템 프롬프트 GJC 산문 비노출 + 보존 경계 grep. `system-prompt-identity.test.ts:63` diff-0는 **C8에서 재정의 예정 — C7 게이트 제외** |
| C8 | **085.5 M3 전수 + 085.6 M1·M3** — `prompts/agents/*.md` 본문, `prompts/jaw/orchestrate-d.md:22`, `src/tools/skill.ts:111`, `src/workflow-state-contract.ts:140,145`, `src/hooks/skill-state.ts:624`, `src/gjc-runtime/state-runtime.ts` stderr, `src/session/agent-session.ts:1076` / `src/system-prompt.ts:283` 이름-우선 1줄, 신규 `src/gjc-runtime/agent-identity.ts`, `src/modes/components/assistant-message.ts:19`, `status-line/segments.ts:74`·`presets.ts:36,60` 렌더 텍스트 | 085.5 M3·085.6 M1/M3 | `system-prompt-identity.test.ts` 하드 baseline 재정의 green |
| C9 | **085.5 M4 + M5b + M6 잔여** — 번들 4종 `src/defaults/gjc/skills/*/SKILL.md` 하드(`gjc team`→`jwc team`, `GJC_TEAM_*` env는 보존), `src/gjc-defaults.ts:130`, `src/hooks/skill-keywords.ts:20-74` + **번들 본문 가드 반전**(`default-gjc-definitions.test.ts:319-371` jwc 필수·gjc 산문 금지로) + commands 잔여 `${APP_NAME}` | 085.5 M4·M6 | M5b 반전 가드 green (**M4와 동일 커밋 — 감사 이슈#1 원자화**) |
| C10 | **085.5 M7 — gjc bin 제거 + 파급 전수** — `packages/gajae-code/bin/gjc.js`+`package.json:29-31` bin 등록 제거. 파급(감사 이슈#3): `scripts/ci-dev-affected.ts:218`, `scripts/release-publish-order.test.ts:21,35,51`, `scripts/ci-release-publish.ts:60`, `scripts/verify-g002-gates.ts:27`(ALLOWED_PACKAGE_BINARIES), `scripts/rebrand-inventory.ts:35`(expectedCliBins), `bun.lock` 재생성, `scripts/install-tests/run-ci.sh:63,108`(gjc 스모크→jwc 전환 — 재감사 발견), `test/brand-visual-identity.test.ts` gjc probe 제거, **`test/gjc-dogfood-template.test.ts` 가드는 여기서 반전/정리(이중 배정 해소 — C7 아님)** | 095 §2-#1 파급 | `bun packages/jwc/bin/jwc.js --version` 스모크 + release/CI 스크립트 테스트 green |
| C11 | **057 M1-M2 + §6 P10** — 신규 `src/gjc-runtime/cli-jaw-vocab.ts`(dev 어휘 맵)+`src/extensibility/skills.ts:398-410` 분기, 신규 `src/gjc-runtime/stage-skill-map.ts`+`src/gjc-runtime/orchestrate-runtime.ts:345` 주입+audit 서브에이전트 포인터 | 057 | `skill-brand-compat`·stage 주입 테스트 신규 green |
| C12 | **085.6 M4 + W4 문서 정합** — 신규 `test/agent-identity-leak.test.ts`, devlog 구플랜 "[구원칙 폐기]" 배너, `README.jwc.md:7-8`, `structure/gitstructure.md:45-46`, 코드 주석 4곳(`cli.ts:56`·`builtin-registry.ts:1235`·`settings-schema.ts:259`·`system-prompt.ts:281`), `struct_har/` 재생성 | 085.6 M4·095 W4 | grep 구원칙 현행 서술 0 + **e2e: jwc "너는 누구야" → Jaw, GJC 비언급** |

이후 (조건부): **060 goal 병합 C13~** — 061 M1-M7 순서. C12까지 check:ts 0·가드 green이면 착수.

## 검증 총괄 (goal 완료 기준)

1. `bun run check:ts` exit 0 (C5 이후 매 커밋 유지)
2. `git status` clean (C5 시점부터 유지)
3. 반전 가드(M5a+M5b)·신규 테스트 전부 green
4. jwc TUI "너는 누구야" e2e — Jaw 정체성·jwc 런타임 인지·GJC 비언급
5. 구원칙 현행 서술 0 (배너 처리 제외)

## 리스크·결정 잔여

- 비즈니스 결정 잔여 0 — 인터뷰 260612 01:36/02:04/02:17 전항 확정 (nextAction은 M1 보류, 060 범위)
- C7/C9 게이트 이원화(M5a/M5b)로 중간 커밋 RED 모순 해소 — C9는 M4+M5b 원자 커밋
- C10에서 `@gajae-code/coding-agent`의 자체 bin(`package.json:30-31`)은 보존 — 제거 대상은 gajae-code **셸 패키지의 gjc 진입점**만 (구현 시 워크스페이스 의존 재확인)
