# 020_omp_D13_session_settings_startup

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D13 — session settings and startup lifecycle
> Sol priority: P3
> Model-related: no
> Card target: 20.065_session_settings_startup
> Worker: OW8

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `46ad90824` | rename settings keys to avoid nested lookup collisions | settings schema/manager |
| 2 | `9afedb591` | add opt-in task prewalk and tighten tools/xdev | CLI flags; settings; task execution |
| 3 | `faf4890b0` | anchor plan-mode re-entry on the new request | plan-mode prompt |
| 4 | `24960899a` | lazily load compiled extension modules | plugin compatibility loader |
| 5 | `ed4ddcba6` | await session disposal on non-interactive exits | print/RPC modes; session lifecycle |
| 6 | `7b07ad7d6` | rearm prewalk after tool progress | `packages/coding-agent/src/session/agent-session.ts` |
| 7 | `b993c0d10` | make prewalk continuation one-shot | `packages/coding-agent/src/session/agent-session.ts` |
| 8 | `cefa91494` | keep prewalk armed across todo turns | session prewalk state |
| 9 | `2fe124987` | stop the prewalk completion-turn loop | session prewalk state |
| 10 | `c32ea55ba` | keep todo active and avoid prewalk gate deadlock | session/task/todo owners |
| 11 | `b31eccbc2` | add todo batching guidance and opt-in arming | prompt; SDK |
| 12 | `da24614d5` | expose prewalk status and scrollback rebuild control | status line; settings; TUI |
| 13 | `f80fb4836` | update prewalk-plan guidance | prewalk plan prompt |
| 14 | `4df6f6683` | finalize the prewalk CLI/session surface | CLI; settings; session; prompts |
| 15 | `449310eb1` | keep startup changelog version current | changelog utility |
| 16 | `f53411295` | bound startup changelog rendering | main/command startup; changelog utility |
| 17 | `1a3e137f1` | show a print-mode working indicator | `packages/coding-agent/src/modes/print-mode.ts` |
| 18 | `dac54080d` | skip autolearn capture after aborted turns | autolearn controller |

## 주제 분석

이 클러스터는 세션이 시작되고 종료될 때 설정과 보조 자동화가 사용자 요청을 침범하지 않도록 경계를 조정한다. dotted/nested settings key 충돌을 제거하고, task prewalk는 명시적 opt-in일 때만 켜며 continuation을 한 번만 소비한다. todo turn과 tool progress 사이에서도 arming 상태를 정확히 유지해 completion loop와 deadlock을 막는다.

startup changelog는 현재 버전을 정확히 표시하되 출력 크기를 제한한다. plan mode 재진입은 과거 계획이 아니라 새 요청을 기준으로 삼는다. compiled extension은 필요할 때 로드하고, print/RPC 종료에서는 `session.dispose()` 완료를 기다린다. aborted turn은 autolearn 자료로 저장하지 않아 오염된 학습 기록을 남기지 않는다.

## Worktree 대조

JWC에는 `settings-schema.ts`, `plan-mode/`, `print-mode.ts`와 session disposal 경로가 있다. 하지만 `prewalk` 및 `autolearn` owner는 현재 워크트리에 없으며 JWC는 goal/plan/task runtime을 별도 계약으로 운용한다. 따라서 prewalk는 직접 기능 포팅보다 opt-in continuation 불변식의 참고 항목이다. settings key, bounded startup output, non-interactive disposal은 기존 JWC owner에 직접 비교할 수 있고, 현재 수정 중인 `agent-session.ts`와 충돌 가능성이 높아 적용 시 독립 diff 검토가 필요하다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `0420d44d3` | fix(coding-agent): preserved reasoning syntax in titles | session/settings/startup |
| 2 | `3666cb93d` | fix(coding-agent): rejected prose thinking session titles | session/settings/startup |
| 3 | `3d2568060` | fix(coding-agent): dispatched CLI entry in Bun.build-compiled windows binaries | session/settings/startup |
| 4 | `501c3592b` | fix(session): land tree navigation on /skill: injection node | session/settings/startup |
| 5 | `65b0f0532` | fix(coding-agent): preserved markerless thinking titles | session/settings/startup |
| 6 | `72b1ddf04` | fix(session): validate pending exit diagnostics | session/settings/startup |
| 7 | `851186f5d` | fix(coding-agent): stripped thinking from session titles | session/settings/startup |
| 8 | `8ff4590d3` | fix(coding-agent): preserved continue target after flag reparse | session/settings/startup |
| 9 | `900ffef06` | feat(settings): changed default text verbosity from high to medium | session/settings/startup |
| 10 | `a16c60014` | fix(coding-agent): hid reasoning envelope title markers | session/settings/startup |
| 11 | `a45a62860` | fix(coding-agent): strip continued ids after extension reparse | session/settings/startup |
| 12 | `bc7a143c1` | fix(setup): used portable native install artifacts | session/settings/startup |
| 13 | `bdad9ca8c` | fix(session): recover interrupted switched sessions | session/settings/startup |
| 14 | `c8975cda5` | fix(session): skipped remote streaming edit pre-cache | session/settings/startup |
| 15 | `d7fe28bcb` | fix(coding-agent): rejected unknown continued session ids | session/settings/startup |
| 16 | `de236903d` | fix(session): close all interrupted transcript tails | session/settings/startup |
| 17 | `df7aa6d01` | fix(cli): awaited config JSON stdout flush | session/settings/startup |
| 18 | `e3e5bf877` | fix(session): recovered interrupted session turns | session/settings/startup |
| 19 | `e4bbe34f6` | config(coding-agent/config): disabled astGrep tool by default | session/settings/startup |
