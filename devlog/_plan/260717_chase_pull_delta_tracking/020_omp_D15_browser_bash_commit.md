# 020_omp_D15_browser_bash_commit

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D15 — browser/bash/commit resilience
> Sol priority: P3
> Model-related: no
> Card target: 20.066_browser_bash_commit
> Worker: OW8

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `86b188cd4` | Puppeteer 패치에서 유실된 추가 행 표식을 복원 | `patches/puppeteer-core@25.3.0.patch` |
| 2 | `23c78e74d` | stealth acquire 경로에 `debugCatchError` 적용 | browser stealth patch, browser regression tests |
| 3 | `33e87d593` | headless browser close를 제한 시간 안에 끝내 tab cleanup 해제 | `packages/coding-agent/src/tools/browser/registry.ts` |
| 4 | `7b399b32a` | tab·cmux·orphan target teardown 대기를 bounded wait로 전환 | browser registry, tab supervisor |
| 5 | `5105b2cd4` | stealth logger 예외로 인한 browser crash 방지 | Puppeteer stealth patch/tests |
| 6 | `9ebc23928` | selector가 계속 0건이면 조기 실패하는 watchdog 추가 | browser prompt, tab worker |
| 7 | `a9cdaf427` | browser tool 실행 흐름과 결과 계약 표준화 | browser cmux/run-output/tab worker |
| 8 | `980d24e24` | Puppeteer locator timeout을 만드는 isolated-world 반환 오류 수정 | Puppeteer patch |
| 9 | `d993b13c8` | browser 상호작용 실패·timeout의 투명성과 안정성 강화 | browser cmux RPC, tab worker |
| 10 | `a9e6e4e67` | 취소 시 격리 bash shell과 자식 프로세스를 명시적으로 abort | bash executor |
| 11 | `ea320d745` | command substitution 안의 중첩 internal URL 해석 수정 | bash skill URL expander |
| 12 | `159484ca6` | agent teardown 전에 commit host completion 수행 | agentic commit, non-interactive env, git utils |
| 13 | `4eaca82fa` | macOS 비관리 stderr 출력의 TUI viewport 오염 차단 | TUI terminal, utils stderr guard/postmortem |
| 14 | `51cc34ac6` | empty-stop 자동 재시도 소진을 조용히 삼키지 않고 실패로 표시 | agent session empty-stop guard |
| 15 | `aeed4d10d` | 빈 Markdown HTML comment가 assistant 출력으로 보이지 않게 처리 | TUI Markdown renderer |

## 주제 분석

이 클러스터는 브라우저 자동화의 종료 경계, bash 실행 취소, commit 종료 순서, 터미널 출력 오염을 한 묶음으로 다룬다. 공통 문제는 작업 자체보다 주변 lifecycle이 먼저 끝나거나 무한히 기다려서 정상 결과를 잃는다는 점이다. JWC에는 browser supervisor와 bash 실행기, 비대화형 commit 흐름이 모두 있으므로 단순 파일 복사보다 timeout·abort·dispose의 소유권을 각각 대조해야 한다.

특히 `159484ca6`은 commit 생성이 teardown보다 앞서야 한다는 순서 불변식을 만든다. `33e87d593`·`7b399b32a`·`a9e6e4e67`은 종료가 반드시 bounded해야 한다는 같은 원칙을 browser와 shell에 적용한다. `51cc34ac6`은 재시도 실패가 사용자에게 보이는 최종 상태로 수렴해야 한다는 운영 계약을 보강한다.

## Worktree 대조

현재 JWC에는 `packages/coding-agent/src/tools/browser/tab-supervisor.ts`, `packages/coding-agent/src/tools/bash-skill-urls.ts`, `packages/coding-agent/src/session/agent-session.ts`가 있어 대응 surface가 존재한다. browser teardown과 bash internal URL은 직접 diff 대조 대상이다. 반면 upstream Puppeteer patch는 JWC의 patch 버전과 적용 맥락을 먼저 확인해야 한다.

현재 worktree에는 agent/session, TUI Markdown, postmortem 관련 미커밋 변경이 함께 존재한다. 이 클러스터를 카드화할 때는 해당 변경을 덮지 않고, commit-before-teardown과 empty-stop failure가 이미 다른 경로로 구현됐는지 먼저 판별한다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `0ae8efd64` | feat: integrated coreutils as in-process shell builtins | browser/bash/commit |
| 2 | `0d07da529` | feat(coding-agent-tools): implemented browser execution safety controls | browser/bash/commit |
| 3 | `172691f6e` | feat: removed redundant pre-execution bash command fixup logic | browser/bash/commit |
| 4 | `17486d200` | fix(utils): create log dir before redirecting stderr guard | browser/bash/commit |
| 5 | `198efb3e4` | feat: enabled bsd compatibility for core utilities and command arguments | browser/bash/commit |
| 6 | `5a73d65b7` | feat(shell): integrated additional coreutils into shell builtins | browser/bash/commit |
| 7 | `6b2f4ad5d` | feat(vendor/uu-stat): enabled bsd-style stat syntax support | browser/bash/commit |
| 8 | `6f7b2483d` | fix(internal-urls): ignore non-directory artifact candidates | browser/bash/commit |
| 9 | `8c8afaf47` | fix(browser): made tab evaluation use the main world | browser/bash/commit |
| 10 | `8eb9b6d25` | fix(shell): materialized process substitution fds for builtins | browser/bash/commit |
| 11 | `90c4726ba` | fix(launch): passed Windows PTY arguments directly | browser/bash/commit |
| 12 | `96cc9caa6` | feat(launch): enabled pty terminal rendering with standardized dimensions and serialization | browser/bash/commit |
| 13 | `991c166d8` | feat(vendor): introduced vendored coreutils with in-process execution support | browser/bash/commit |
| 14 | `acc0211cf` | feat(tools): integrated terminal rendering into launch tool output | browser/bash/commit |
| 15 | `b76f7aeec` | fix(launch): scope batch validation to PTYs | browser/bash/commit |
| 16 | `d12997278` | fix(tail): stopped windows broken-pipe flush from killing omp | browser/bash/commit |
| 17 | `df047effe` | fix(cli): guarded documented marketplace verbs from launch leak | browser/bash/commit |
| 18 | `e29fbce55` | fix(internal-urls): serve history:// transcripts from disk fallback | browser/bash/commit |
| 19 | `e542f762c` | fix(pi-shell): mapped BrokenPipe stdout errors to silent fd exit code 141 | browser/bash/commit |
| 20 | `f7ed71830` | fix(utils): share active postmortem cleanup | browser/bash/commit |
