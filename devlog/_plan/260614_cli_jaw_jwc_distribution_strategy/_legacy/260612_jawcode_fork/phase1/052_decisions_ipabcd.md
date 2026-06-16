# 052 — 050 IPABCD 결정 전집 (jaw-interview R0–R10)

> 2026-06-12 jaw-interview 세션 산출. **050번대 lexicographic 연속** — `051` 보강(`51.n`) 없이 본 문서에서 050 밴드 결정을 이어감.
> 선행: [050_moc_plan_pabcd.md](./050_moc_plan_pabcd.md), [051_design_command_port.md](./051_design_command_port.md)
> **P Boss-author 후속:** [053_decisions_p_boss_author.md](./053_decisions_p_boss_author.md) — D050-10~26 (속집 2에서 P/A 리뷰어 재배치: D050-11/12/15는 D050-19/20/21로 개정·폐기). 구현 diff: [054_plan_orchestrate_impl.md](./054_plan_orchestrate_impl.md)
> 인터뷰 로그: [04_interview_log.md](./04_interview_log.md)

## Metadata

| 항목 | 값 |
|------|-----|
| Interview ID | e4c29588-713a-42bd-be75-0aa7c690e68e |
| Rounds | 0 (topology) + 10 (Q&A) |
| Final Ambiguity | 8% |
| Threshold | 5% (default) |
| Status | **EARLY_EXIT** — 사용자 "052에 기록하고 종료" (threshold 미달) |
| Active topology | 050 Plan+IPABCD only (060+ deferred) |

## 결정 (D050-1 … D050-9)

| ID | 주제 | 결정 | 표기 |
|----|------|------|------|
| D050-1 | `jwc interview` vs `jwc orchestrate i` | **동일 엔진** (040 `jaw-interview`). 차이는 `pabcd.json` 상태 등록·handoff UX만 | [확정] |
| D050-2 | I → P handoff | **자동 stage 전환 금지** (cli-jaw). 허용: (①) 사용자 `/orchestrate p`·`p` 명시, (②) 에이전트 handoff, (③) spec+threshold 충족 시 **orchestrate p 원클릭 제안** | [확정] |
| D050-3 | devlog 기록 규칙 | **050번대 lexicographic 연속** (`052`, `053`, …). 앞 문서 `51.n` 식 보강 금지 | [확정] |
| D050-4 | state-machine 이식 | **M1 사본** — cli-jaw `state-machine.ts` 프롬프트·`canTransition` 이식. **M2 130**에서 단일화 검토 | [확정] |
| D050-5 | B 단계 · team | **jwc 단독 B 기본**. 아주 복잡·대규모면 **team(tmux) 옵션** | [확정] |
| D050-6 | team 트리거 | **에이전트 재량** — B 진입 시 기본 solo | [확정] |
| D050-7 | M1 050 완료 기준 | **`orchestrate i→p→a→b→c→d` 풀사이클 1회** | [확정] |
| D050-8 | `pabcd.json` | `current_stage`, `ctx`, `spec_ref`, `plan_ref` + gjc state receipt 관례. (구현: 논리 계약명 — envelope은 `.gjc/state/pabcd-state.json`, native 레지스트리 D050-22) | [확정] |
| D050-9 | C 단계 | **cli-jaw C와 동형** — 고정 체크리스트 + 기계적 pass/fail | [확정] |

> **P/A 엔진 재매핑** (Boss-author, Critic≠A) → **053** D050-10 … D050-14. 본 문서 D050-1…9는 유효; 050/051의 구 「ralplan Planner(+Architect)=P / Critic=A」 표현은 **053으로 supersede**.

## 050 MOC / 051 패치 체크리스트

- [x] `050_moc` §열린 질문 — D050-1/2/4 → [확정] 승격 (053 세션)
- [x] `051` §4 I→P·state-machine → D050-2/4 반영
- [x] `050_moc` team/B → D050-5/6 반영
- [x] P/A 매핑 → [053](./053_decisions_p_boss_author.md) D050-10…14로 050/051 본문 패치
- [x] C 단계 체크리스트 항목 — 053 D050-17로 [확정] (구현은 054)
- [ ] `051` §B/C 상세 — D050-9 구현 diff (054+)

## 미확정 (054+)

> D 단계·슬래시·C 체크리스트는 [053](./053_decisions_p_boss_author.md) **D050-16…18로 [확정]** (cli-jaw 인터뷰 속집).

- **054** `orchestrate p` 구현 (planner review 프롬프트, orchestrate command)
- **060+ 밴드** — topology defer 해제 후 순차

## Acceptance (본 문서)

- [x] D050-1 … D050-9 devlog 기록
- [x] 050/051 MOC 본문 패치 (053과 동일 세션)
- [ ] `jwc orchestrate` 구현 — 051 §3.1 + 053 인용
