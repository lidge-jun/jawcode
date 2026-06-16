# ralplan 참조 전수 분석

> 서브에이전트 병렬 검증 결과 (260613)

## 핵심 발견

**ralplan-runtime.ts는 삭제 불가** — `jwc ralplan --write`가 orchestrate-p의 실제 퍼시스턴스 채널.
planner/architect/critic 에이전트가 `jwc ralplan --write --stage planner/critic/architect`로 아티팩트 저장.
런타임을 제거하면 orchestrate-p가 깨짐.

**전략 수정**: 스킬 표면(`/skill:ralplan`)만 제거, CLI + 런타임은 유지.

## 카테고리 분류

| 카테고리 | 수 | 설명 |
|---|---|---|
| **KEEP** | ~30 파일 | 런타임, RPC 타입, 상태 머신, 디스크 경로, CLI 커맨드 |
| **REPLACE** | 1 파일 | `skill-keywords.ts` — `$ralplan` 트리거를 `orchestrate`로 변경 |
| **REWRITE** | 4 파일 | 프롬프트 텍스트 — 라우팅 규칙, 퍼시스턴스 동사 명시 |
| **REMOVE** | 0 | 레거시 호환 + `--write` 채널 때문에 완전 삭제 불가 |

## 최우선 수정 (REPLACE)

### hooks/skill-keywords.ts (L41-50)

```typescript
// 현재: $ralplan → skill "ralplan"
// 변경: $ralplan → skill "orchestrate" (또는 제거)
// "consensus plan" → orchestrate p로 라우팅
```

`interactive-mode.ts`에서 이미 ralplan을 autocomplete에서 삭제(L717)했는데 keyword trigger는 아직 레거시 스킬로 보내는 모순.

## 프롬프트 REWRITE 대상

### system-prompt.md

| 라인 | 현재 | 변경 |
|---|---|---|
| 24 | `jaw-interview spec → ralplan consensus` | `→ orchestrate p consensus` |
| 27-29 | `<skill name="ralplan" ...>` | 제거 (동적 렌더로 대체) |
| 42 | `.jwc/plans/ralplan/` 경로 | 경로 유지 (실제 디스크 경로) |
| 53 | `jwc ralplan` CLI 목록 | 유지 (유효한 CLI) |
| 81 | `use ralplan and stop at pending approval` | `run orchestrate p and stop at pending approval` |

### prompts/jaw/orchestrate-p.md (최고 우선순위)

| 라인 | 현재 | 변경 |
|---|---|---|
| 17 | `ralplan --write --stage critic` | `orchestrate verdict --worker-output` (또는 명시 주석 추가) |
| 19 | `the sanctioned ralplan writer` | `the sanctioned orchestrate writer` |

### prompts/agents/planner.md

| 라인 | 현재 | 변경 |
|---|---|---|
| 7 | `bashAllowedPrefixes: jwc ralplan --write` | 유지 (실제 CLI) + 주석 추가 |
| 20-21 | `jwc ralplan --write` 제약 | 주석: `also used by orchestrate p` |
| 57 | `jwc ralplan --write --stage planner` | 유지 + 주석 |

### prompts/agents/architect.md, critic.md

planner.md와 동일 패턴. `bashAllowedPrefixes`, 제약 텍스트, 출력 계약 모두 `jwc ralplan --write` 사용.

### prompts/jaw/orchestrate-a.md (L12)

`"ralplan-vocabulary agent prompts"` → `"orchestrate-p-vocabulary agent prompts"`

### prompts/jaw/orchestrate-b.md (L8)

`.jwc/plans/ralplan/<run-id>/pending-approval.md` — 실제 디스크 경로이므로 **유지**.

## 중요: .jwc/plans/ralplan/ 경로

이 경로는 `ralplan-runtime.ts:getRunDir()`가 생성하는 실제 디스크 경로.
**런타임을 유지하므로 경로도 유지** — 리네임하면 기존 아티팩트 참조가 깨짐.

orchestrate-p → ralplan-runtime → `.jwc/plans/ralplan/` 는 내부 구현 경로로 존속.
사용자/에이전트 대면에서는 "orchestrate p" 어휘 사용, 내부 경로는 숨김.

## KEEP (변경 불필요)

- `ralplan-runtime.ts` 전체 (퍼시스턴스 엔진)
- `cli.ts:46` CLI 등록 (`jwc ralplan` 커맨드)
- `commands/ralplan.ts` 커맨드 클래스
- `commands/interview.ts` `--handoff "ralplan"` / `--deliberate`
- `workflow-manifest.ts` 상태 머신
- `workflow-gate-broker.ts` V1_STAGES
- `approval-gate.ts` stage 값
- `rpc-types.ts` RpcWorkflowStage
- `bash-allowed-prefixes.ts` allowlist
- `skill-state/*.ts` 런타임 로직
- `defaults/jwc/skills/ralplan/SKILL.md` — superseded 마킹 유지, 삭제하지 않음
- `defaults/jwc-defaults.ts` 스킬 등록 — 레거시 호환
