# fork-delta — lidge-jun/jawcode lineage delta index (체리픽 정본)

> upstream lineage: `Yeachan-Heo/gajae-code` (`dev`) · public repo: `lidge-jun/jawcode`. 본 문서는 업스트림 계열 코드에서 Jawcode가 이탈한 파일의 **단일 카노니컬 인덱스**다 — clone diff/체리픽 전 충돌 예상 분석의 첫 진입점. 설계 정본: `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/067.1_plan_structure_fork_delta.md`.
> 갱신 규칙: HARD-EDIT·INVERTED-GUARD·REMOVED·NEW 파일이 포함된 커밋은 본 문서를 **동행 갱신**한다 (SOFT-EDIT는 밴드 일괄 허용). 커밋 트레일러 `Fork-Delta: <종류> <경로>` 규약은 `structure/11_conventions.md` 참조.

## 종류 정의

| 종류 | 의미 | 리베이스/체리픽 처리 |
|---|---|---|
| `NEW` | upstream에 없는 포크 신규 파일 | 자동 보존 / 통째 적용 |
| `HARD-EDIT` | upstream 파일의 산문·식별자 직접 수정 | **충돌 고확률** — 보존 경계 열 참조 |
| `REMOVED` | upstream 존재, 포크에서 삭제 | upstream 재추가 시 re-delete |
| `INVERTED-GUARD` | 가드/허용리스트 논리 반전(gjc→jwc), 테스트 동반 | 충돌 시 포크 논리 우선 |
| `SOFT-EDIT` | `${APP_NAME}` 동적화·픽스처 갱신 등 | 저위험 |

## 보존 경계 — ⚠️ 260613 플립으로 대부분 해제 ([260613_gjc_flip](../devlog/_plan/260613_gjc_flip/00_moc_flip.md))

> 065.1의 "내부 식별자 보존" 결정은 260613 이별/플립 결정으로 **의도적으로 반전**됐다.
> 업스트림 체리픽은 이제 경로/심볼 매핑(gjc-runtime→jwc-runtime, Gjc*→Jwc*, CANONICAL_GJC→JWC 등)을
> 적용해 이식한다 — chase 003 원칙 5(의미론적 팔로우)와 동일 정신.

- ~~`gjc-runtime/`·`gjc-plugins/` 경로 rename 금지~~ → **플립 완료**: `jwc-runtime/`·`jwc-plugins/`·`defaults/jwc/`
- ~~`CANONICAL_GJC_WORKFLOW_SKILLS` 등 심볼 변경 금지~~ → **플립 완료**: `CANONICAL_JWC_WORKFLOW_SKILLS`·`Jwc*`·`Jawcode*`
- ~~receipt.owner 변경 금지~~ → **쓰기 `jwc-*` / 읽기 gjc-* 별칭 수용** (read-both 정규화 4사이트 — 퍼시스트 호환 유지)
- `ENGINE_NAME = "gjc"`(`packages/utils/src/dirs.ts:20`) → **여전히 보존** (이중 브랜드 분모 — 플립 연기 명단, 05 §연기)
- `@jawcode-dev/*` 내부 import 스코프 → 보존 (063.1 전략 B)
- `.gjc/` 상태 경로 → **`.jwc` 전환 완료 (260612 Phase β 본 적용, 0b603b05+d34097b8)** — legacy는 migrate-config-dir 원타임 rename + sentinel. 예외: migrate-config-dir.*·beta-jwc-sweep.ts는 ".gjc" 리터럴 의도 보존

## 델타 인덱스 (260612 C1~C13 기준)

### prompts/ — HARD-EDIT

| 경로 | 종류 | 밴드 | devlog | merge 지침 | 보존 경계 |
|---|---|---|---|---|---|
| `packages/coding-agent/src/prompts/system/system-prompt.md` | HARD-EDIT | 085.5-M2 + 99.03-M1 | 085.5_plan_prompt_rebrand.md · 99.03.01_impl_workflow_surface.md | CONFLICT-EXPECTED | `.jwc/`·public workflow aliases + native-workflow orchestrate 블록 |
| `packages/coding-agent/src/prompts/tools/{bash,skill,recall,reflect,retain}.md` | HARD-EDIT | 085.5-M2 | 동일 | CONFLICT-EXPECTED | — |
| `packages/coding-agent/src/prompts/agents/{planner,architect,critic}.md` | HARD-EDIT+INVERTED-GUARD | 085.5-M1·M3 | 동일 | CONFLICT-EXPECTED | frontmatter는 jwc 접두 |
| `packages/coding-agent/src/prompts/goals/goal-{continuation,mode-active}.md` | HARD-EDIT | 060-061 | 061_design_goal_merge.md | CONFLICT-EXPECTED | — |
| `packages/coding-agent/src/prompts/jaw/` (orchestrate-* 6종 + audit 2종) | NEW | 054/057 | 054_plan_orchestrate_impl.md | N/A | — |

### defaults/jwc/skills — HARD-EDIT

| 경로 | 종류 | 밴드 | merge 지침 | 보존 경계 |
|---|---|---|---|---|
| `…/defaults/jwc/skills/{jaw-interview,ralplan,team,ultragoal}/SKILL.md` | HARD-EDIT(+INVERTED-GUARD) | 085.5-M4, C13, 99.30.02 | CONFLICT-EXPECTED | `GJC_TEAM_*` env·`.jwc/` 경로. jaw-interview는 설정 키 `jwc.interview.*` (c7c748ec). **99.30.02 이별**: public planning은 `plan`/`jwc orchestrate`, public execution ledger는 `goal`/`jwc goal`; ralplan/ultragoal은 내부 엔진명으로만 보존 |
| 부속 md (auto-answer-uncertain 등) | HARD-EDIT | 042/085.5 | MANUAL-REVIEW | — |

### 신규 런타임 (gjc-runtime/ 내 포크 전용) — NEW

| 경로 | 밴드 | devlog |
|---|---|---|
| `…/gjc-runtime/agent-identity.ts` | 085.6 | 085.6_plan_identity_leak_zero.md |
| `…/gjc-runtime/cli-jaw-vocab.ts` | 057 | 057_plan_skill_compat_patch.md |
| `…/gjc-runtime/stage-skill-map.ts` | 057 P10 | 동일 |
| `…/gjc-runtime/goal-runtime.ts` | 060-061 | 061_design_goal_merge.md |
| (기존재 NEW 군) jaw-interview/ralplan/orchestrate/ultragoal/team/state 런타임 일체 | 030~085 | 각 밴드 MOC |

### commands/ · cli

| 경로 | 종류 | 밴드 | merge 지침 |
|---|---|---|---|
| `…/commands/goal.ts` | NEW | 060-061 | N/A |
| `…/commands/{harness,setup,team,worktree,ralplan,state,ultragoal}.ts` | SOFT-EDIT (`${APP_NAME}` 예시) | 085.5-M6 | AUTO |
| `…/src/cli.ts` (jawOnlyCommands: interview/orchestrate/goal) | HARD-EDIT | 050/060 | MANUAL-REVIEW |

### 가드 — INVERTED-GUARD

| 경로 | 밴드 | merge 지침 |
|---|---|---|
| `…/tools/bash-allowed-prefixes.ts` (jwc 접두) | 085.5-M1 | CONFLICT-EXPECTED |
| `…/skill-state/jaw-interview-mutation-guard.ts` (:254 jwc) | 085.5-M1 | CONFLICT-EXPECTED |
| `…/hooks/skill-keywords.ts` | 085.5-M4 | CONFLICT-EXPECTED |
| `packages/coding-agent/test/default-gjc-definitions.test.ts` (jwc 필수·gjc 어휘 금지 반전) | 085.5-M5 | CONFLICT-EXPECTED |
| `scripts/verify-g002-gates.ts`·`scripts/rebrand-inventory.ts` (gjc 셸 항목 제거) | 085.5-M7 | MANUAL-REVIEW |

### 인증/providers

| 경로 | 종류 | 밴드 | merge 지침 | upstream PR 후보 |
|---|---|---|---|---|
| `packages/ai/src/utils/oauth/local-token-detect.ts` | NEW | 094.3 | N/A | ✅ (버그픽스/범용 성격) |
| `packages/ai/src/utils/oauth/{anthropic,openai-codex,xai}.ts` | HARD-EDIT/NEW | 094.3 | MANUAL-REVIEW | ✅ |
| `packages/ai/src/providers/kiro.ts` | NEW | 091 | N/A | 검토 |
| `packages/ai/src/auth-storage.ts` | HARD-EDIT | 094.3 | MANUAL-REVIEW | ✅ |

### REMOVED

| 경로 | 밴드 | 처리 |
|---|---|---|
| `packages/jawcode/` (셸 패키지 4파일) | 085.5-M7 (C10) | upstream 갱신 시 **re-delete**. `packages/jwc`가 단일 진입점 |

### TUI·세션

| 경로 | 종류 | 밴드 |
|---|---|---|
| `…/modes/components/welcome.ts`·`assistant-message.ts`·`session/agent-session.ts` | HARD-EDIT | 086/085.6 + welcome.ts 99.20.05 배너 임계 7→4 (`e0fba53c`) |
| `…/modes/theme/defaults/abyss-bite{,-light}.json` | NEW | 086 |
| `…/discovery/cli-jaw.ts` | NEW | 031 |
| `…/session/agent-session.ts` | HARD-EDIT | 99.20.05 — `/fast` → serviceTier 설정 영속 (`e0fba53c`) |
| `…/modes/controllers/extension-ui-controller.ts` | HARD-EDIT | 99.20.05 — ask 휠 반환(마우스 리포팅 제거) (`e0fba53c`) |
| `…/tools/ask.ts` | HARD-EDIT | 99.20.05 — ask 휠 반환 배선 (`e0fba53c`) |

### 확장·도구 (computer_use · coordinator) — NEW

| 경로 | 종류 | 밴드 | merge 지침 | 비고 |
|---|---|---|---|---|
| `packages/coding-agent/src/tools/computer-use.ts` | NEW | computer-use | N/A | discoverable `computer_use`; `902a17f8` |
| `packages/coding-agent/src/tools/computer-use-backend.ts` | NEW | computer-use | N/A | `LazyCuaDriverBackend` — 첫 호출 전까지 `cua-driver mcp` 미기동 |
| `packages/coding-agent/src/prompts/tools/computer-use.md` | NEW | computer-use | N/A | tool prompt |
| `packages/coding-agent/src/coordinator/contract.ts` | NEW | Hermes/coordinator | N/A | `COORDINATOR_MCP_TOOL_NAMES` → `jwc_coordinator_*` |
| `packages/coding-agent/src/coordinator-mcp/server.ts` | NEW | Hermes/coordinator | N/A | MCP bridge; `7ccea93c` rename |
| `packages/coding-agent/src/defaults/jwc-defaults.ts` | HARD-EDIT | computer-use | MANUAL-REVIEW | managed MCP에서 `cua-driver` 제거; `context7`만 기본 |
| `packages/coding-agent/src/tools/index.ts` | HARD-EDIT | computer-use | AUTO | `computer_use` discoverable registry |
### 포크 전용 디렉터리 (전체 NEW — 엔트리 불요)

`structure/`, `devlog/`, `struct_har/`, `packages/jwc/`, `prompts/jaw/`, `prompts/goals/`(HARD-EDIT 2종 제외).
### 풀 jwc 포팅 (P2~P12, 260612 16:4x~18:0x — goal 3f6989ac)

| 경로 | 종류 | 밴드 | merge 지침 | 비고 |
|---|---|---|---|---|
| `packages/utils/src/dirs.ts` | HARD-EDIT | 062.1-M2 | CONFLICT-EXPECTED | APP_NAME 기본 "jwc" + JWC_ env 체인 |
| `packages/utils/src/env.ts` | HARD-EDIT | 062.1-M1 | CONFLICT-EXPECTED | $resolveEnv + JWC→GJC 로드타임 미러 |
| `packages/coding-agent/src/discovery/helpers.ts` | HARD-EDIT | 062.1 §4 | CONFLICT-EXPECTED | isJawBrand 기본 jwc + 매니페스트 키 jwc→gjc→pi |
| `packages/coding-agent/src/gjc-runtime/goal-mode-request.ts` | HARD-EDIT | 062.1-M4 (D-4) | CONFLICT-EXPECTED | JWC_SESSION_* 양쪽 SET |
| `packages/coding-agent/src/modes/bridge/bridge-mode.ts` | HARD-EDIT | 062.1-M3 | MANUAL-REVIEW | $resolveEnv 체인 |
| `packages/coding-agent/src/internal-urls/gjc-protocol.ts` | HARD-EDIT | 065.1-D | CONFLICT-EXPECTED | scheme jwc + legacy gjc alias |
| `packages/coding-agent/src/task/gjc-command.ts` | HARD-EDIT | 065.1-E | MANUAL-REVIEW | DEFAULT_CMD jwc |
| `packages/coding-agent/src/hooks/codex-native-hooks-config.ts` | HARD-EDIT | 064.1-M2 | MANUAL-REVIEW | 관리 명령 jwc codex-native-hook |
| `packages/coding-agent/src/skill-state/jaw-interview-mutation-guard.ts` | HARD-EDIT | 064.1 S-14 | CONFLICT-EXPECTED | 에러 문구 jwc |
| `packages/coding-agent/src/config/settings.ts` | HARD-EDIT | 낙진 수리 | MANUAL-REVIEW | 테마 마이그레이션 브랜드-인식 |
| `docs/environment-variables.md` | HARD-EDIT | 062.1-M7 | AUTO | JWC_ 전수 93건 + legacy 노트 |
| `packages/jwc/package.json`·`packages/jwc/src/cli-entry.ts` | HARD-EDIT/NEW | 063.1 (P12, D-3) | MANUAL-REVIEW | 번들 퍼블리시 독립화 |
| `scripts/ci-release-publish.ts` | HARD-EDIT | 063.1 | MANUAL-REVIEW | preBuild 선행 + jwc bundle |
| `packages/coding-agent/src/migrate-config-dir.ts` | NEW | 061.1-M4 (β 키트) | N/A | .gjc→.jwc 원타임 마이그레이터 (".gjc" 리터럴 보존 — 스윕 제외 파일) |
| `scripts/beta-jwc-sweep.ts` | NEW | 069.1 P9~P11 (β 키트·본 적용 260612) | N/A | 경계 안전 스윕 + 픽스업 14건 일체형 (.py/.ps1 포함, 멱등 재실행 가능) |
| `packages/coding-agent/src/migrate-config-dir-startup.ts` | NEW | 061.1-M4 (P10 배선) | N/A | cli.ts 최우선 side-effect import — 로거 선행 생성 회피, 워크스페이스 import 금지 |
| `packages/coding-agent/src/cli.ts` | HARD-EDIT | 061.1-M4 (P10 배선) | MANUAL-REVIEW | 1번째 import = migrate-config-dir-startup (순서 불변 계약) |
| `scripts/verify-g002-gates.ts` | HARD-EDIT | 069.1 P9 (라운드-2 픽스업) | AUTO | bin 키 이행기 허용형 (jwc ?? gjc) |
| `packages/jwc/bin/jwc.js` | HARD-EDIT | 99.02.01 (260612) | MANUAL-REVIEW | 워크스페이스 프로브 우선 — dist 번들은 퍼블리시 설치 전용 (stale 번들 버그 수정) |
| `packages/coding-agent/src/main.ts` | HARD-EDIT | 99.02.01 (260612) | MANUAL-REVIEW | checkForNewVersion에 dev 체크아웃 가드 (`test/` 존재 시 스킵). **99.05-W1 (`a7e20053`)**: jaw 브랜드면 npm 업데이트 체크 전체 조기 반환 (npm "jwc" 이름 스쿼팅 회피) |
| `packages/tui/src/components/viewport-fill.ts` | NEW | 083.7 (컴포저 하단 고정) | N/A | 센티널 스페이서 — tui 코어는 센티널 부재 시 no-op (diff-0 보존) |
| `packages/tui/src/tui.ts` | HARD-EDIT | 083.7 | MANUAL-REVIEW | `#expandViewportFill` 1메서드 + #doRender 호출 1줄 (오버레이 합성 이전 고정 계약) |
| `packages/coding-agent/src/modes/interactive-mode.ts` | HARD-EDIT | 083.7 | MANUAL-REVIEW | chatContainer 직후 ViewportFill 마운트 + 브랜드 기본(jaw=on/gjc=off)·`tui.composerPin`·`PI_NO_COMPOSER_PIN` 해석 |
| `packages/coding-agent/src/modes/interactive-mode.ts`·`modes/types.ts` | HARD-EDIT | 083.7 §11 + 99.20.04 | MANUAL-REVIEW | fill을 chat 위로(B2-lite) + liveToolContainer 신설 |
| `packages/coding-agent/src/modes/controllers/event-controller.ts`·`input-controller.ts` | HARD-EDIT | 99.20.04 + 99.20.03 | MANUAL-REVIEW | 커밋 폴딩(라이브 존 라우팅·커밋점 2곳·agent_end 잔여) + 압축 트리거(슬래시·ctrl+o/t) |
| `packages/coding-agent/src/config/settings-schema.ts` | HARD-EDIT | 083.7/99.20.04 | AUTO | `tui.composerPin`·`tool.renderMode` (브랜드 기본) |
| `packages/coding-agent/src/modes/components/settings-selector.ts`·`packages/tui/src/components/settings-list.ts` | HARD-EDIT | 99.20.04 핫픽스 (260613) | AUTO | undefined currentValue 가드 ("default" 표기) — truncateToWidth 크래시 회귀 방지 |
| `packages/coding-agent/src/modes/interactive-mode.ts` | HARD-EDIT (예정) | 99.30.01 | MANUAL-REVIEW | `#renderTodoList` 전부 `completed` 시 1줄 접힘 — [session_storage.md](./22_session_storage.md) |

## 리베이스/체리픽 절차 (요약 — 상세: 067.1 §5)

- 리베이스/체리픽 전: `grep "CONFLICT-EXPECTED" structure/40_fork-delta.md` ↔ `diff -qr devlog/_gjc_chase/gajae-code/packages packages` 대조
- upstream→fork 체리픽: 대상 커밋이 HARD-EDIT 경로를 건드리면 보존 경계 열 기준 수동 병합
- fork→upstream 기여: `upstream PR 후보` ✅ 항목만


---

# (merged) Fork Logic Changelog (동작·런타임·계보)


---

## Fork logic changelog (jawcode vs jawcode upstream)

> **정본**: upstream `f0a8a3eb` (`devlog/_gjc_chase/gajae-code/`, `upstream/dev`) 대비 worktree `af363c8` (`main`)의 **동작·계약·런타임** 변경. 파일 목록은 [fork-delta.md](./40_fork-delta.md), 밴드 스냅샷은 [struct_har/](../struct_har/README.md).
> **99 잔여 갭**: `99.02` PR/CI 마감·`99.04` HUD·`99.07` 슬래시 패리티 등 — [status.md](./50_status.md) · [099_stabilization](../struct_har/jwc_patched/099_stabilization/02_logic_changes.md).
> 생성: current worktree + GJC chase clone 기준 주요 커밋 메시지·diff 경로 교차 (2026-06-26).

### 요약 축

| 축 | 핵심 로직 변경 |
|---|---|
| **표면** | `jwc` 단일 CLI; `gjc` 셸 패키지 제거; `APP_NAME`/`ENGINE_NAME` 분리; `jwc://` URL 스킴 |
| **경로** | 런타임 `.jwc/` + `migrate-config-dir` 원타임; 세션 env `JWC_*`↔`GJC_*` 미러 |
| **인터뷰** | `deep-interview` → `jaw-interview`; gate·mutation-guard·structured ask·설정 `jwc.interview.*` |
| **PABCD** | `orchestrate`/`pabcd` 네이티브 state machine + stage prompts + jaw-only brand gate |
| **Goal** | `goal` CLI + `goal-runtime` 어댑터; ultragoal 엔진 유지, 세션 goal mode 연동 |
| **스킬** | cli-jaw 글로벌 스킬 치환; dev 스킬 어휘; stage-skill-map 주입 |
| **프롬프트** | system/tools/agents 하드 jaw화; `agent-identity`; identity leak 테스트 |
| **TUI** | abyss-bite 테마; 도구 접기/간격/추론 세그먼트; provider 탭; `/quota`·`/effort` |
| **Auth** | 로컬 토큰 autodetect/import; kiro provider+OAuth; stale credential 정리 |
| **Cursor** | host model pin; native tool-call 실행/렌더 수정; autocompact estimate 폴백 |
| **가드** | bash allowlist·mutation-guard·default-gjc-definitions **jwc 기준 반전** |
| **확장** | builtin `computer_use` lazy proxy (`902a17f8`); Hermes `jwc_coordinator_*` MCP (`7ccea93c`) |

---

### 010 — 셸·브랜드·릴리스

- `packages/jwc`: package `jawcode`, bin `jwc`, `jawcode/sdk` 재수출; `cli-entry` 번들 퍼블리시 (P12).
- `packages/jawcode` **삭제** — 더 이상 repo 내 `gjc` bin 없음.
- `dirs.ts`: `APP_NAME` 기본 `jwc`, config `~/.jwc`; `ENGINE_NAME`/`gjc` 내부 식별자 보존.
- `rebrand-inventory` / `verify-g002-gates`: 기대 bin·스킬 4종을 **jwc 어휘**로 확장·반전.
- 커밋: `7d55513b` jwc shell, `bb6571a0` gjc bin 제거, `6c9b3c53` jwc publish, `59d10c66` ENGINE/APP split.

### 020 — 프롬프트·정체성

- `system-prompt.md`: legacy jawcode 산문 → Jaw/jwc 워크플로 표면; skill XML `jaw-interview`·`jwc` CLI 예시.
- `agent-identity.ts`: 설정 기반 이름/말투/언어 블록 (`identity.*` settings).
- Role agents (`planner`/`architect`/`critic`): bash allowlist **jwc** 접두; ralplan state 쓰기만 허용.
- Tools prompts (`bash`, `skill`, memory tools): 브랜드·경로 `.jwc` 정합.
- `system-prompt-identity.test.ts` / `agent-identity-leak.test.ts`: TUI "너는 누구야" → Jaw, legacy jawcode 비언급.
- 커밋: `da701492`–`ff11c848` C7–C8, `db31d4bd` C12, `59043f77` identity settings.

### 030 — 스킬 디스커버리

- `discovery/cli-jaw.ts` **NEW**: `~/.cli-jaw/skills` 등 cli-jaw 루트 병합.
- `extensibility/skills.ts`: jaw-brand **substitution model** (글로벌 스킬명 치환).
- `cli-jaw-vocab.ts`: dev 스킬 본문 어휘 맵 (057).
- `DEFAULT_GJC_DEFINITION_NAMES`: `jaw-interview` (upstream `deep-interview`).
- 커밋: `49da5846` discovery, `02ca8ba2` C11, `af7523f9` jaw-brand.

### 040 — Interview

- Rename: `deep-interview` → `jaw-interview` (SKILL, runtime, gate, guards, fixtures).
- `jaw-interview-runtime.ts`: spec 경로·phase·topology gate 유지 + jaw 4차원/structured ask.
- `structured-renderer.ts` + `ask.ts`: elicitation meta·D041 스키마 렌더.
- `jaw-interview-mutation-guard.ts`: `.jwc/` 쓰기 전용; jwc CLI만 허용 (가드 반전).
- `jaw-interview-gate.ts`: workflow gate 브로커 연동.
- 설정 키: `gjc.jawInterview.*` → **`jwc.interview.*`** (c7c748ec).
- 레거시: state 파일명 `deep-interview-state.json` 등 read-compat (042).
- 커밋: `eb4273c2` B1, `1be32975` B2, `8ced9eb2` B3, `063114c9` B5, `c7c748ec` settings.

### 050 — Plan / PABCD / orchestrate

- `orchestrate-state.ts`: native registry, transitions, verdict parser (D050-22).
- `orchestrate-runtime.ts`: stage I/P/A/B/C/D entry, gates, audit sub-prompts, fail-closed writer.
- `commands/orchestrate.ts` + slash `/orchestrate`; **jaw-only brand gate** (D050-24).
- `prompts/jaw/orchestrate-*.md` + audit planner/architect lens.
- `ralplan` SKILL: jwc CLI 예시; pending-approval; handoff ultragoal.
- 테스트: `orchestrate-state.test.ts`, `cli-command-surface` brand 분기.
- 커밋: `595350bf` B1, `975302db` B3, `0d38fe05` B4, `09c76c23` B2, `5f1d442a` B2 surface.
- **모델 discovery (99.03)**: M1/M2/M3 ✅ — `45cba4e2`·`8a7ea342`·`90ef5223` — [status.md](./50_status.md)

### 060 — Goal / ultragoal

- `commands/goal.ts` **NEW**: cli-jaw-shaped goal verb surface.
- `goal-runtime.ts`: jaw evidence/pause/done 계약 → ultragoal 엔진·`.jwc/ultragoal` ledger.
- `goal-mode-request.ts`: 세션 스코프 `sessionId` (457-class fix 유지).
- goal SKILL/commands: public `jwc goal *` wording; internal ultragoal engine checkpoint quality-gate.
- 커밋: `0207d326` C13 M1–M7, `db31d4bd` goal tests 연동.

### 070 — Memory

- jwc: memories startup stage1→phase2; 주입 `memory_summary.md` + (local) Task Snapshot·`local-query`/`memory-fts` (**99.01** 마감·테스트·문서 동기화 중).
- cli-jaw 패리티: BM25/RRF/trigram 일부 후속 — [session_storage.md](./22_session_storage.md).
- structure: [session_storage.md](./22_session_storage.md).

### 080–086 — TUI·HUD·브랜딩

- 테마 `abyss-bite` / `abyss-bite-light`; welcome/banner Jawcode (086).
- `model-selector`: provider 탭 CLAUDE/CODEX/LOCAL (084).
- `/quota` slash + provider quota UI (094.4).
- `/effort` reasoning effort selector (083.4).
- Workflow HUD: IPABCD 띠·인터뷰 게이지·goal 세그먼트 (085 MOC; 일부 WIP).
- `status-line/segments.ts`: jaw 라벨.
- 커밋: `3bc79781` C3, `89800b67` C5a, `7259a7c6` C4, `33fbee4d` 083.4.

### 081 — Cursor·composer

- `cursor.ts` + provider: **host model pin**, IDE convention disclaimer (081.6).
- Tool-call: render + execute 경로 수정 (02b50ad9, 081.1–3).
- `composer-discipline.ts`: autocontinue/anchor 관련 (081.8–9).
- `agent-session` autocompact: usage under-report 시 **content estimate 폴백** (081.7).
- 커밋: `e12e03d4`, `02b50ad9`, `16ce10d7`.

### 082–083 — 입력·출력

- IME: Ctrl-chord 한글 힌트 (082.1); editor first-char caret (082.2); ESC 2연타 안전망.
- `custom-editor` + hook-selector 인라인 입력 (082.3 계획 일부).
- 도구 블록: 완료 시 **auto-minimize** (083.1); spacing 1줄 (083.2); assistant **segment split**으로 추론↔tool interleave 복원 (083.3).
- `tool-transcript-overlay` alt+t (083.1 pattern A).
- 커밋: `cc61d506`, `d14ed4e2`, `3a858246`, `a590aea9`, `b06d48c7`.

### 090–094 — Auth·provider

- `local-token-detect.ts`: Claude Code/Codex/Grok 등 로컬 자격증명 탐지·import.
- OAuth 경로 보강 (`anthropic`, `openai-codex`, `xai`); auth-storage stale 제거.
- `kiro.ts` provider + `oauth/kiro.ts` (091 WIP).
- 커밋: `a17d5ac0` C2, `4d7733c2` kiro WIP.

### 061 / Phase β — 경로·마이그레이션

- `beta-jwc-sweep.ts`: 소스 `.gjc` 경로 리터럴 → `.jwc` (1530건/227파일, 경계 안전).
- `migrate-config-dir.ts`: `~/.gjc`→`~/.jwc`, 프로젝트 `.gjc`→`.jwc`, sentinel 멱등.
- `migrate-config-dir-startup.ts`: `cli.ts` **첫 import** (로거 순서 계약).
- `cli.ts` `jawOnlyCommands`: interview, orchestrate, goal 네이티브 등록.
- 커밋: `0b603b05` P9+P11, `d34097b8` P10, `0d7383df` 키트.

### 062–065 — Env·URL·명령

- `env.ts` `$resolveEnv`: **JWC→GJC→PI** 체인; 런타임 미러.
- `gjc-protocol.ts`: **`jwc://`** + `gjc://` legacy redirect.
- `gjc-command.ts`: subagent default **`jwc`** (`--jwc-command`, deprecated `--gjc-command`).
- `workflow-command-ref` / manifest: jwc 네이티브 CLI 표면.
- 커밋: `184a77da` P2, `c3e9cc13` P3, `314c0ceb` P5, `1affa135` P6, `cec8e763` P7.

### State / workflow (횡단)

- `state-schema.ts`: `jaw-interview` canonical; legacy `deep-interview` read-compat.
- `state-runtime` / `state-writer`: jwc stderr·reconcile; receipt owner `gjc-runtime` **보존**.
- `skill-state` / `skill-keywords`: jaw-interview 키워드; Stop/handoff 게이트.
- `bridge-client/workflow-gate.ts`: stage enum에 `jaw-interview` + legacy `deep-interview`.

### 테스트·가드 반전 (085.5)

- `default-gjc-definitions.test.ts`: 번들 4종 + **jwc 산문 필수**, gjc 사용자 표면 금지.
- `bash-allowed-prefixes` / `bash-interceptor`: role agent **jwc** prefix.
- `gjc-dogfood-template`: jwc 템플릿 기준.
### 99 밴드 (미구현 — 결정 260612)

| GG | 갭 | structure |
|---|---|---|
| 99.03 | discovery M1/M2/M3 + re-facing [확정] | [status.md](./50_status.md) |
| 99.01 | memory CLI + local-query/FTS | [session_storage.md](./22_session_storage.md) |
| 99.02 | CI schemas·biome | [status.md](./50_status.md) |

### 99.20 / 99.30 밴드 + gjc→jwc 플립 (260613)

- **gjc→jwc 소스 플립** (`8e17a1ce`, F1–F5): 디렉터리(jwc-runtime/jwc-plugins/defaults/jwc 등)·심볼
  (Gjc→Jwc 88파일, GajaeCode→Jawcode)·receipt owner(jwc-* write, gjc-* read-both)·goals.json 필드
  (jwc* + 레거시 폴백)·ACP `_jwc/` 별칭(+`_gjc/` 유지)·기본 커맨드 `jwc`·테스트/픽스처 리네임. 내부
  패키지 스코프 `@jawcode-dev/*`는 보존(D4). 상세: [_fin/260613_gjc_flip](../devlog/_fin/260613_gjc_flip/00_moc_flip.md), 인덱스 [fork-delta.md](./40_fork-delta.md).
- **99.20.08 `/help` 도킹 2-페인 카탈로그**: 모델-셀렉터 문법, builtin/skill/custom 탭 분할, enter로
  커맨드 삽입 — [extensibility.md](./21_extensibility.md).
- **99.20.07 TUI 레이아웃 정규화 (P1–P4)**: OAuth 로그인 플로우→`LoginDialogComponent` 도킹
  (`7aeee91c`), read-once 리포트→`ScrollablePanel`(신규 컴포넌트, `8203b611`), 1줄 성공 알림→상태
  표면(`a1a8db42`), MCP 연결 대기→상태 표면의 stock `Loader`(`1f7cbd58`). 트랜스크립트 오염 제거.
- **99.10 thinking 셀 포커스 링**: thinking 보유 assistant 셀이 ctrl+↑ 포커스 링(083.1 패턴-B)에
  도구 셀과 함께 합류, alt+t 트랜스크립트 오버레이는 `FocusableCell` 유니온으로 확장 (`4cd64e1b`).
- **99.30.02 ralplan 이별**: jaw-interview 핸드오프를 `jwc orchestrate p --spec-ref`로 재배선,
  ralplan SKILL superseded(스텁), ultragoal 플래닝 전제 네이티브화 — [extensibility.md](./21_extensibility.md).
- **`/model` allowArgs**: `/model <id>`가 채팅으로 폴스루하던 버그 수리(`492913de`) + TUI handleTui
  인자형 위임(`bc732ce7`). cmd_audit P1 종결 — [search.md](./30_providers.md) §4.

### fast / service_tier · Codex 전송 (관측성)

- `/fast` 설정 영속화(`serviceTier`)는 [fork-delta.md](./40_fork-delta.md). 실현-vs-요청 표시 시도
  (`bf4feb28`, ⚡? 푸터)는 **되돌림**(`7315a7a6`): `service_tier` 에코는 fast-실현 신호 아님.
- Codex WS/SSE 전송·프리워밍·워치독·레이트리밋 텔레메트리 = [providers.md](./30_providers.md)
  (`76176ce3`·`93b7b66e`·`36738838`·`cd41e54d`·`bad0a8e1`).

### 리베이스 시 주의

- HARD-EDIT 파일에서 **동작** 우선: D4(`.jwc/`, `@jawcode-dev/*`, receipt owner) > upstream 문구.
- Phase β 이후 문서·스냅샷은 `.jwc/` 기준; AGENTS.md upstream 계약은 수정 금지.

### 업스트림 계보 (omp → jawcode → jawcode)

> **Pi**(badlogic/pi-mono) → **oh-my-pi(omp)** → **jawcode** → **jawcode(`jwc`)**.
> jawcode는 jawcode 0.4.4 포크; 공개 명령·상태는 `jwc`/`.jwc`, 내부 식별자(`@jawcode-dev/*`,
> `GJC_*`)는 리베이스 보존 경계.

| | omp | jawcode(upstream) | jawcode(jwc) |
|---|---|---|---|
| CLI bin | `omp` | `gjc` | **`jwc`** (단일 진입) |
| npm scope | `@oh-my-pi/*` | `@jawcode-dev/*` | `@jawcode-dev/*` 유지 + `packages/jwc` |
| interview | (스킬/`.omp`) | `deep-interview` | **`jaw-interview`** |
| config dir | omp 관례 | `.gjc/`→`.jwc` 전환 | **`.jwc/`** |
| 문서 SoT | README+docs | upstream docs | **AGENTS.md + structure/** + devlog |

- jawcode는 omp 계열 포크. jawcode 리베이스 1차 대상 = **jawcode**; omp는 기능/아키텍처
  선행 참고. 스냅샷: [struct_har/omp_origin/](../struct_har/omp_origin/README.md).
- 보존(리베이스 비용): `@jawcode-dev/*` 워크스페이스, `packages/coding-agent/` 코어(HARD-EDIT는
  [fork-delta.md](./40_fork-delta.md) 추적), upstream baseline(`devlog/_gjc_chase/gajae-code/`·`struct_har/gjc_origin/`).
- 표면(jwc): bin·브랜딩·번들 스킬 slug(`jaw-interview`)·시스템 프롬프트 Jaw 아이덴티티·cli-jaw 정렬.
- 동기화: `git -C devlog/_gjc_chase/gajae-code pull --ff-only upstream dev`→`conventions.md`·`struct_har/gjc_origin/**`;
  `devlog/_omp_chase/oh-my-pi` fetch→`struct_har/omp_origin/**`+regenerate-omp 스크립트.

*갱신: struct_har 밴드 `02_logic_changes.md`는 본 문서 절을 밴드별로 요약·링크한다.*
