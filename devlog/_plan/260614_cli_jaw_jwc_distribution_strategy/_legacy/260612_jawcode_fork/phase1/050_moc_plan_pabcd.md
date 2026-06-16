# 050 MOC — 워크플로 병합 ②: Orchestrate IPABCD

> 📐 상세 설계: [051_design_command_port.md](./051_design_command_port.md) — D10 표면 3종(orchestrate/goal/memory)의
> 명령 아키텍처(CLI Command 클래스 + 슬래시 2계층, jaw 브랜드 게이트), cli-jaw 이식 자산 표(state-machine
> getPrefix/getStatePrompt/canTransition/parseWorkerVerdict), **IPABCD 단계 엔진·전이 매핑**.
>
> 🔗 선행 밴드: [040 MOC](./040_moc_interview_merge.md) — **I 단계 엔진**(`jaw-interview` 스킬·spec write).
> 본 밴드는 I를 포함한 **오케스트레이션 표면·상태머신**을 담당한다. 사용자 관점 파이프라인은 하나:
> `orchestrate i → p → a → b → c → d` (cli-jaw `orchestrate i|p|a|…`와 동형).
>
> 📌 P/A 재매핑: [053_decisions_p_boss_author.md](./053_decisions_p_boss_author.md) (D050-10 … D050-26, 속집 1~4)

> 상태: 🟢 구현 완료 (054 plan → B 빌드). **P = Boss-author + Critic 1-pass / A = Planner∥Architect 병렬 감사** [확정 D050-19/20].
> 결정 근거: D3 [확정] 매핑 병합 — deep-interview↔I, ralplan 리뷰·artifact↔P, ultragoal↔goal (05 §D3).
> **P/A 분리(D050-19~21):** Critic=품질@P(1-pass, p_round ≤2), Planner=정합@A ∥ Architect=통합@A(a_round ≤3), trivial→A solo(Architect). 수정 권한은 항상 Boss.

## 040 ↔ 050 역할 분리

| 밴드 | 담당 | 산출물 | 사용자 진입 |
|------|------|--------|-------------|
| **040** | I **엔진** — 인터뷰·게이트·spec | `jaw-interview` 스킬, `.gjc/specs/jaw-interview-{slug}.md` | `jwc interview` / `/interview` (I 단독) |
| **050** | **IPABCD 오케스트레이션** — 단계 전이·상태·프롬프트 주입 | `commands/orchestrate.ts`, `.gjc/state/pabcd.json`, `prompts/jaw/orchestrate-*.md` | `jwc orchestrate i\|p\|a\|b\|c\|d`, `jwc pabcd`, `/orchestrate` |

**handoff 계약:** 040 spec → `orchestrate p` 입력. I 완료 시 `pabcd.json`에 `spec_ref` 기록. P는 spec을 Boss가 읽고 초안 작성; 리뷰 artifact는 ralplan writer로 영속화 ([D050-13](./053_decisions_p_boss_author.md)).

```
모호한 요청 ──► orchestrate i (또는 interview 단독)
                    │
                    ▼
            jaw-interview spec (040 엔진)
                    │
                    ▼
orchestrate p ──► a ──► b ──► c ──► d
  Boss 초안 +        Planner∥Architect
  Critic 1-pass      병렬 감사 (trivial→solo)
(spec 있으면 p부터 진입 가능)
```

## 병합 소재

| 출처 | 가져올 것 |
|------|----------|
| gjc ralplan | **리뷰 subagent** (Planner/Architect/Critic 순차), `--write --stage`, pending-approval, receipt-only, `--deliberate`, pre-execution gate — **작성자 역할은 P에서 Boss가 가져감** (053 D050-10) |
| jaw orchestrate | **I/P/A/B/C/D 단계 분리** + 명시 전이, **P = Boss plan 초안 + CEO 승인 STOP**, **A = audit employee PASS/FAIL**, B Boss 구현, C 기계 검증, D 요약 |
| 040 jaw-interview | I 엔진 — 050은 재구현 없이 `orchestrate i` / `interview` 호출 |

## P/A 단계 — 리뷰어 재배치 [확정 053 속집 2, D050-19~21]

| 역할 | 단계 | 담당 | 산출 |
|------|------|------|------|
| **Boss** (메인) | P/A | spec → devlog plan 초안, 사용자 요약/Mermaid, 감사 발견 수정 적용 | devlog plan 파일, `plan_ref` |
| **Critic** subagent | P | 품질 1-pass — AC 누락·스코프 구멍·모호 단계, OKAY/ITERATE/REJECT, `p_round ≤2` | `stage-*-critic.md` receipt |
| **Planner** subagent | A | 계획 정합 감사 (read-only), PASS/FAIL + file:line 증거 | `orchestrate-audit-planner.md` 프롬프트 |
| **Architect** subagent | A | 통합 리스크 감사 (read-only), PASS/FAIL, 델타 재감사 `a_round ≤3` | `orchestrate-audit-architect.md` 프롬프트 |
| **ralplan CLI** | P | artifact writer | `pending-approval.md` (실행 게이트 정본) |

**trivial bypass [확정 D050-21]:** 단일 파일·단일 동작·명시 AC → **A 감사 1명(Architect solo)**, `ctx.a_audit_mode: "solo"|"dual"`. P측 short/full 모드는 폐기(D050-15→21).

**`/skill:ralplan` [D050-14]:** Planner-author consensus **별도 유지** — IPABCD `orchestrate p`와 SKILL 본문 통합은 M1 범위 밖.

## 스코프

1. **I = orchestrate i**: 040 `jaw-interview`; `pabcd.json` 등록은 orchestrate i만 [확정 D050-1]
2. **P = orchestrate p**: **Boss 초안 + Critic 1-pass** → pending-approval → 사용자 승인 STOP [확정 D050-10/13/19]
3. **A = orchestrate a**: **Planner∥Architect 병렬 감사** + `parseWorkerVerdict`(PASS|FAIL, D050-23) — Boss 수정→델타 재감사 ≤3 [확정 D050-20]
4. **B/C/D**: jaw 계약 — B executor, C 체크리스트 pass/fail [D050-9], D 요약
5. **명령 표면 [확정 D10]**: `jwc orchestrate i|p|a|b|c|d`, alias `pabcd`, 슬래시 `/orchestrate`, `/pabcd`
6. **상태**: envelope `.gjc/state/pabcd-state.json`(논리 계약명 `pabcd.json`) — `current_phase`, `ctx`, `spec_ref`, `plan_ref`, `ctx.a_audit_mode` — **native 레지스트리, canonical 4종 무접촉** [D050-8/21/22]

## [확정] / [기본값] 결정

- 번들 스킬 4종 가드 — IPABCD는 **네이티브 명령+상태머신+프롬프트** (R14)
- 단계 전환 **명시 `orchestrate <stage>`만** [D050-2]
- I→P **자동 전환 금지** — 사용자 `/orchestrate p`·handoff·원클릭 제안만 [D050-2]
- 아티팩트: ralplan `--write` 재사용; `.gjc/plans/` 직접 편집 금지
- P/A 종료 STOP; B team은 복잡·대규모 시 옵션 [D050-5/6]
- M1: cli-jaw `state-machine.ts` **사본** 이식 [D050-4]; M2 130 단일화 검토

## 완료 기준

- `jwc orchestrate i` → spec → `p` → `a` → `b` → `c` → `d` 풀사이클 1회 [D050-7]
- spec 보유 시 `orchestrate p` 단독 e2e
- P: Boss devlog + `pending-approval.md`; 승인 전 mutation 0건
- P: subagent receipt-only; A: PASS/FAIL 게이트

## 열린 질문

- ~~D 단계 요약 형식~~ → [확정 D050-16] cli-jaw D 동형 + `pabcd.json` receipt ([053](./053_decisions_p_boss_author.md))
- ~~C 체크리스트 cli-jaw 심볼 이식~~ → [확정 D050-17] 3스테이지 사본 + repo 게이트 (053)
- ~~슬래시 HUD~~ → [확정 D050-18] `/orchestrate` 정본 + `/pabcd` alias; HUD는 080 위임 (053)
- **054** `orchestrate p` 구현 diff — planner review 프롬프트, `commands/orchestrate.ts`
