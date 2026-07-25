# 020_omp_D09_advisor_steering

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D09 — advisor steering and terminal blocker safety
> Sol priority: P2
> Model-related: no
> Card target: 20.061_advisor_steering
> Worker: OW6

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `54df76be8` | steer a late blocker after the terminal answer | session turn routing |
| 2 | `581bfed6b` | preserve a terminal blocker when ACP defers turns | `packages/coding-agent/src/session/agent-session.ts` |
| 3 | `aff195a91` | arm the immune window only after steering | `packages/coding-agent/src/session/agent-session.ts` |
| 4 | `3af5c2a5c` | assert the terminal blocker turn | session advisor regression tests |
| 5 | `ac0f9f795` | clarify terminal blocker routing | session routing contract |
| 6 | `b3ac21a2e` | cover terminal blocker continuation | session advisor regression tests |
| 7 | `c0a021686` | close quarantine containment gaps | advisor runtime boundary |
| 8 | `77115fe16` | quarantine unsafe advise notes | advisor runtime boundary |
| 9 | `9c961acd6` | clear quarantined native payloads | advisor runtime boundary |
| 10 | `a58e8faa0` | quarantine unknown tool responses | advisor runtime; session handoff |
| 11 | `7d72ee9e0` | preserve explicit empty tool lists | advisor config/UI |
| 12 | `708eafaf8` | preserve late advisor terminal notes | advisor tool; session routing |
| 13 | `645cf45ed` | preserve all terminal advisor notes | `packages/coding-agent/src/session/agent-session.ts` |
| 14 | `ea5324fb1` | trust only advisor tool-result provenance | advisor runtime; session routing |

## 주제 분석

이 클러스터는 advisor가 본 답변보다 늦게 도착하더라도 실제 blocker를 잃지 않게 하는 turn-routing 규칙을 강화한다. steering이 실제로 일어난 경우에만 immune window를 열고, ACP가 다음 agent turn을 미루는 경우에도 terminal blocker를 이어 간다. 동시에 advisor가 허용되지 않은 tool 응답이나 native payload를 일반 조언처럼 주입하지 못하도록 quarantine 경계를 닫는다.

핵심은 “늦은 검토 결과를 보존한다”와 “출처가 불명확한 검토 결과를 실행 경로에 넣지 않는다”를 동시에 만족하는 것이다. 빈 tool 목록도 기본값으로 덮어쓰지 않아야 하며, terminal note는 출력 순서 때문에 소실되어서는 안 된다.

## Worktree 대조

JWC에는 OMP의 `packages/coding-agent/src/advisor/` 디렉터리와 동일한 runtime이 없다. 현재 유사 책임은 `packages/coding-agent/src/task/fork-context-advisory.ts`, task advisory 모듈, `workflow-gate-broker.ts`, `agent-session.ts`에 분산되어 있다. 따라서 직접 포팅 대상은 없으며, late blocker 전달 순서와 tool-result provenance/quarantine 불변식을 JWC의 task receipt·workflow gate 경계에 매핑한 뒤 별도 카드에서 적합성을 판정해야 한다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `1a4c19501` | fix(coding-agent): accepted silent advisor stops with output tokens | advisor/steering |
| 2 | `4114d280b` | fix(coding-agent/advisor): treated zero-content advisor stop turns as valid review completions | advisor/steering |
| 3 | `441197b46` | fix(advisor): address review: wip on PendingDelta, MAX_COALESCE_ROUNDS cap, annotateForStaleness extraction | advisor/steering |
| 4 | `59017f261` | fix(advisor): address final review: wip return type, import order, cap edge case, cap test | advisor/steering |
| 5 | `74715f8cc` | fix(advisor): reduce stale advisories via delta coalescing, WIP markers, and delivery annotation | advisor/steering |
| 6 | `8608395ee` | fix(coding-agent): rejected empty advisor stops | advisor/steering |
| 7 | `dabb2291a` | fix(advisor): kept defaults for invalid tools | advisor/steering |
