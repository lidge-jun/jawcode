# chase — gjc 참조 방안

> **플랜 정본**: [10_gjc_chase_MOC](./10_gjc_chase_MOC.md) · `10.001`–`10.008` (+ `10.009`…) · 완료 [_fin/10](./_fin/10/README.md)
> **정본 클론**: `devlog/_gjc_chase/gajae-code/` · branch `dev` tracking `upstream/dev` · reviewed through **`a791d72a`** (2026-06-28 chase hardening)
> **jaw SoT**: worktree `packages/` — 병합 시 [structure/40_fork-delta.md](../../structure/40_fork-delta.md) **CONFLICT-EXPECTED** 열 필수.
**jwc 포팅 명명**: [008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md) (`jwc-rpc`, `.jwc`, `jwc` CLI).

## 원칙 (jaw = upstream OSS)

1. gjc는 **계보 형제**이지 jaw의 릴리즈 보스가 아님.
2. 참조 = **읽기·diff·선별 포팅** — 전체 리베이스 의무 없음.
3. **jaw 불변**: orchestrate, jaw-interview, `.jwc` 런타임, INVERTED-GUARD, `packages/jwc` 단일 bin.
4. **γ 경계**: `gjc-runtime/` 경로, receipt owner `gjc-runtime`, `@jawcode-dev/*` import (063.1 B).
5. **ralplan 이별 (99.30.02, 260613)**: jaw의 합의 플래닝은 네이티브 orchestrate P단계로
   단일화 — upstream의 ralplan 트랙(스킬 문서·consensus 루프 개선, 예: #395/#396)은
   **체리픽 금지, 의미론적 팔로우만**: 아이디어가 가치 있으면 orchestrate 런타임/프롬프트에
   번역 이식하고 chase 플랜(`10.NNN`)으로 등재. ralplan SKILL.md·ralplan-runtime은 레거시
   호환 동결 (구조 철거는 99.30.02 3단계 마일스톤).

## 절차 (한 사이클)

```bash
git -C devlog/_gjc_chase/gajae-code fetch upstream dev
GJC=$(git -C devlog/_gjc_chase/gajae-code rev-parse --short HEAD)
JWC=$(git -C /Users/jun/Developer/new/700_projects/jawcode rev-parse --short HEAD)
grep CONFLICT-EXPECTED structure/40_fork-delta.md
diff -u devlog/_gjc_chase/gajae-code/packages/coding-agent/src/cli.ts packages/coding-agent/src/cli.ts | head
```

| 단계 | 행동 |
|---|---|
| 1 | upstream CHANGELOG `packages/coding-agent/CHANGELOG.md` — jaw에 없는 **Fixed/Added** 훑기 |
| 2 | 경로가 fork-delta **HARD-EDIT**면 — 기능만 추출, Jaw 문구 유지 |
| 3 | **NEW** upstream only — 버그픽스면 jaw에 이식 검토 (auth, session) |
| 4 | 이식 후 `struct_har` regen + chase [002_gap_inventory](./002_gap_inventory.md) 상태 갱신 |

## 영역별 참조 맵

### packages/ai (우선 **높음**)

| 참조할 것 | gjc 경로 | jaw 주의 |
|---|---|---|
| OAuth·local token | `utils/oauth/local-token-detect.ts` | jaw kiro **분리 유지** |
| auth-storage stale | `auth-storage.ts` | HARD-EDIT — 수동 |
| provider 추가 | `providers/*`, descriptors | models.json **generate만** |
| auth-gateway | `packages/ai/src/auth-gateway/` | 설정 호환 확인 |

### packages/coding-agent — 세션·compaction

| 참조 | 파일 | jaw 상태 |
|---|---|---|
| autocompact threshold | `packages/coding-agent/src/session/agent-session.ts` | HARD-EDIT + jaw TUI |
| continuation after compact | 동일 | CHANGELOG #442 클래스 |
| harness recover | `gjc-runtime/harness*` | diff 후 선택 |

### packages/coding-agent — RPC / team runtime

| 참조 | 내용 | chase |
|---|---|---|
| RPC stdio lifecycle | malformed JSONL recovery, EOF/shutdown `ensureOnDisk`, host bridge cleanup, include-gated `get_state` payload | [10.008](./10.008_gjc_chase_rpc_lifecycle.md) |
| RPC registry / UDS | session-registry, `--listen`, **`jwc_rpc.list_sessions`** | [10.018](./10.018_gjc_chase_rpc_registry_uds.md) |
| Python RPC client | upstream `python/gjc-rpc` → jwc **`python/jwc-rpc`** | [008](./008_gjc_jwc_naming_contract.md) · [10.026](./_fin/10/10.026_gjc_chase_rpc_issues_audit.md) |
| team tmux profile | `GJC_TMUX_LAUNCHED_ENV`-guarded `@gjc-profile` self-heal without foreign-session hijack | [10.007](./10.007_gjc_chase_team_profile_self_heal.md) |

### packages/coding-agent — task

| 참조 | 내용 |
|---|---|
| subagent sessionId | OAuth provider — jaw 이미 forward (CHANGELOG) |
| forkContext | 설정 `task.forkContext.enabled` — jaw executor/architect `allowed` |

### packages/coding-agent — cursor (081)

```bash
diff -u devlog/_gjc_chase/gajae-code/packages/coding-agent/src/cursor.ts packages/coding-agent/src/cursor.ts
diff -u devlog/_gjc_chase/gajae-code/packages/ai/src/providers/cursor.ts packages/ai/src/providers/cursor.ts
```

upstream **호스트 model pin**·tool-call 수정 — jaw 고유 수정과 **3-way 병합**.

### packages/tui

- 순수 렌더/버그만 선별 — jaw 082 IME·083 segment와 **충돌 구간 분리**.

### **가져오지 말 것** (fork-delta)

- `system-prompt.md` upstream 문구 **덮어쓰기**
- `deep-interview` slug 복귀
- `packages/gajae-code/` 복원
- 가드 테스트를 gjc 기준으로 **되돌리기**

## struct_har 연동

| 밴드 | gjc_origin | jwc_patched | chase |
|---|---|---|---|
| 각 | `02_code_facts` | `02_logic_changes` | `chase/bands/<band>.md` |

## fork-delta “upstream PR 후보” (역기여 선택)

jaw에서 gjc로 돌려보낼 만한 범용 수정 — [fork-delta.md](../../structure/40_fork-delta.md) 090 표 ✅:

- `local-token-detect.ts`
- oauth 보강 (anthropic, openai-codex, xai)
- `auth-storage.ts` 일부

브랜딩 전용(agent-identity, orchestrate, jaw-interview)은 **비대상**.

## Jawdev chase expansion — 2026-06-26

> Document: `struct_har/chase/003_reference_from_gjc.md`
> Title: chase — gjc 참조 방안
> Lane: GJC
> Status: active chase card
> Canonical source: `devlog/_gjc_chase/gajae-code` (dev tracking upstream/dev)
> Primary patch surfaces: packages/coding-agent/

### Why this is behind or can drift

1. This card exists because JWC must reconcile a concrete upstream/reference behavior with the current Jawcode fork, not because file names happen to differ.
2. The comparison source is devlog/_gjc_chase/gajae-code; agents must not substitute `devlog/_upstream_*` or the root repository history as the chase baseline.
3. The current drift risk is semantic: behavior, workflow state, command contract, persistence, or operator evidence can diverge even when a simple diff looks small.
4. The fork also carries JWC-specific naming, `.jwc` state, and Jawdev workflow rules, so a direct copy from the source lane can be wrong.
5. For active cards, the lag means JWC either lacks the source behavior, lacks a matching guard, or has not documented a conscious rejection.
6. For completed cards, the lag can return when the source clone advances past the reviewed HEAD or when adjacent JWC code changes without updating this card.
7. Index and MOC documents can drift by pointing agents at stale priority, stale branch names, stale clone paths, or already-finished work.
8. The first Jawdev obligation is to restate the delta in JWC terms before touching implementation files.
9. The second obligation is to decide whether the source behavior is a product requirement, a reference pattern, or a rejected mismatch.
10. The third obligation is to bind the decision to a verification gate so later agents can prove the card is closed.

### Where to patch

1. Start from this document, then open the current source lane at `devlog/_gjc_chase/gajae-code` and the matching JWC files under packages/coding-agent/.
2. For GJC-sourced cards, compare against `devlog/_gjc_chase/gajae-code` on `dev` tracking `upstream/dev`.
3. For OMP-sourced cards, compare against `devlog/_omp_chase/oh-my-pi` on `main` tracking `origin/main`.
4. Patch only the JWC implementation surface after the delta is understood; do not edit the chase clone.
5. Keep public command names, state directories, and user-facing examples JWC-first: `jwc`, `.jwc`, and `@jawcode-dev/*`.
6. If a source path uses upstream names such as `gjc`, translate them through `008_gjc_jwc_naming_contract.md` before copying any behavior.
7. If this card points to docs/index behavior, update `structure/`, `struct_har/chase/`, and the relevant devlog plan rather than product code.
8. If this card points to runtime behavior, add or update the nearest package test before declaring the card finished.
9. If the correct patch surface is outside packages/coding-agent/, record why the owner changed in the devlog before widening scope.
10. Do not batch this card with unrelated chase cards unless a MOC explicitly says they form one PABCD bundle.

### Decision needed before patching

1. Decide whether to import the source behavior, adapt it to JWC, reject it, or split it into smaller cards.
2. Decide whether the user-visible contract changes; if yes, update docs and tests with the same patch.
3. Decide whether persistence/state migration is involved; if yes, identify the `.jwc` state files and rollback posture.
4. Decide whether subagents must learn a new rule; if yes, promote the durable rule to `AGENTS.md` or `structure/`, not only this chase file.
5. Decide whether the source behavior conflicts with the fork's TUI, workflow, or naming constraints.
6. Decide whether this card is still active; if already implemented, move or keep it under `_fin` with evidence instead of reopening vague work.
7. Decide which verification command is authoritative for the changed surface: focused test, `bun run check:tools`, `bun run check:ts`, smoke test, or manual artifact proof.
8. Decide whether a failed broad check is caused by this card; unrelated failures must be recorded, not hidden.
9. Decide whether the implementation needs a follow-up goal because the card implies more than one atomic patch.
10. Decide what evidence will convince a read-only reviewer that the chase gap is actually closed.

### Verification and done evidence

1. Re-read this file after patching and verify the stated source lane still matches devlog/_gjc_chase/gajae-code.
2. Run a focused diff against the source lane and paste the relevant file anchors into the devlog or final report.
3. Run the package-level focused test that proves the affected behavior, not just a broad lint pass.
4. Run `bun run check:tools` for repository formatting/lint hygiene.
5. Run `git diff --check` before committing to catch whitespace and conflict-marker mistakes.
6. If `bun run check:ts` is relevant and fails, classify whether the failure is caused by the patch or a pre-existing dependency drift.
7. Update this card's status line, MOC row, or `_fin` placement only after evidence exists.
8. Add a devlog evidence note for the patch surface, tests, reviewer, and any known residual risks.
9. Ask a read-only reviewer to challenge the closure if the patch touches runtime behavior, workflow state, or subagent routing.
10. Commit only the card's intended docs/code/test files; preserve unrelated worktree changes.

### Sub-agent handoff contract

1. A sub-agent must start from the Project root `/Users/jun/Developer/new/700_projects/jawcode`, not from `~/.cli-jaw`.
2. A sub-agent must read `AGENTS.md`, `structure/00_INDEX.md`, and this file before proposing implementation.
3. A sub-agent must resolve the chase baseline from `devlog/_gjc_chase/gajae-code` and verify the branch with `git status --short --branch`.
4. A sub-agent must treat the source clone as read-only evidence unless the explicit task is to fast-forward that clone.
5. A sub-agent must write the patch against JWC files only and must not stage clone contents.
6. A sub-agent must preserve JWC naming and translate upstream identifiers through the naming contract.
7. A sub-agent must report decisions in terms of import/adapt/reject/split, not as vague 'needs follow-up' text.
8. A sub-agent must name the exact files that should change before editing them.
9. A sub-agent must include verification output, not just an implementation summary.
10. A sub-agent must leave this document more accurate than it found it whenever the card's status changes.

### Minimum patch worksheet

1. Source anchor checked: devlog/_gjc_chase/gajae-code.
2. Source branch checked: dev tracking upstream/dev.
3. JWC owner files listed before edit: packages/coding-agent/.
4. Naming contract checked against `008_gjc_jwc_naming_contract.md`.
5. Current MOC row checked for priority and status.
6. Current devlog plans searched for prior implementation or rejection.
7. Related tests searched before adding new tests.
8. Runtime/state risk classified as none, local, or migration.
9. User-facing command/help change classified as yes or no.
10. Subagent instruction change classified as yes or no.
11. Implementation option chosen: import, adapt, reject, or split.
12. Rejection rationale written if source behavior is not adopted.
13. Focused verification command selected.
14. Broad hygiene command selected.
15. Reviewer/audit route selected when risk is not local.
16. Documentation update location selected: this card, MOC, `structure/`, or devlog.
17. Commit scope listed before staging.
18. Known unrelated failures separated from card failures.
19. Completion evidence attached to final report.
20. Card status changed only after evidence is present.

### Decision log slots

1. Decision A — source behavior classification: import / adapt / reject / split.
2. Decision B — JWC naming impact: none / command text / state path / package namespace.
3. Decision C — test impact: existing test update / new focused test / manual evidence only.
4. Decision D — docs impact: chase only / structure promotion / AGENTS durable rule.
5. Decision E — rollout impact: no migration / local state migration / user-visible behavior note.
6. Decision F — residual risk: closed / monitored / intentionally deferred.
7. Decision G — reviewer needed: no / docs / backend / frontend / architecture.
8. Decision H — bundle policy: single-card commit / PABCD bundle / separate goal.

### Done-state wording

When this card is closed, the final note should say: produce a focused patch or explicit rejection note.
It should cite the source commit, JWC commit, files changed, focused verification, and any rejected source behavior.
It should not say 'done' solely because the document is longer or because a broad lint command passed.
It should leave enough evidence for a future agent to re-open the comparison without reading the whole chat history.
