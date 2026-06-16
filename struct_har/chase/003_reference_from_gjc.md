# chase — gjc 참조 방안

> **플랜 정본**: [10_gjc_chase_MOC](./10_gjc_chase_MOC.md) · `10.001`–`10.035` · 완료 [_fin/10](./_fin/10/README.md)
> **정본 클론**: `devlog/_upstream_gjc/` · branch `dev` · reviewed through **`5ed80862`**
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
git -C devlog/_upstream_gjc fetch origin
GJC=$(git -C devlog/_upstream_gjc rev-parse --short HEAD)
JWC=$(git -C /Users/jun/Developer/new/700_projects/jawcode rev-parse --short HEAD)
grep CONFLICT-EXPECTED structure/40_fork-delta.md
diff -u devlog/_upstream_gjc/packages/coding-agent/src/cli.ts packages/coding-agent/src/cli.ts | head
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
diff -u devlog/_upstream_gjc/packages/coding-agent/src/cursor.ts packages/coding-agent/src/cursor.ts
diff -u devlog/_upstream_gjc/packages/ai/src/providers/cursor.ts packages/ai/src/providers/cursor.ts
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