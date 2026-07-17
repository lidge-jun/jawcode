# 010_gjc_C18_docs_changelog_qa

> Range: `4a80bac9..3ddf26079`
> Cluster: C18 — docs/changelog/QA
> Sol priority: P3
> Model-related: ✗
> Card target: 10.104_docs_changelog_qa
> Worker: GW7

이 클러스터는 release와 사용자 표면을 설명하는 문서가 실제 실행 증거와 함께 움직이도록 만든다. changelog 중복 제거, SDK application guide 복구, TUI PTY transcript와 dogfood report 같은 재검증 가능한 QA artifact를 묶는다.

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `ca2701ef3` | docs(sdk): repair application development guide | `docs/sdk-app-guide.md` |
| 2 | `8a9be6334` | docs: drop stale 0.10.2 pairing version from release prose; assert GH_REPO | release docs/tests |
| 3 | `c3bd1d4ce` | test(qa): record G003 v0.10.1 release evidence (npm 14/14, GitHub release, tag) | release QA artifact |
| 4 | `073246515` | test(qa): record G003 v0.10.1 release evidence (npm 14/14, GitHub release, tag) | release QA artifact |
| 5 | `79f9a06d8` | chore: restore Unreleased changelog sections after failed v0.10.1 release | package changelogs |
| 6 | `547a82a41` | test(qa): add G002 TUI PTY capture as structural live-surface evidence | TUI PTY artifact |
| 7 | `418be0f6d` | test(qa): make G002 dogfood harnesses fail-closed and complete the surface matrix | dogfood harness |
| 8 | `94d880997` | test(qa): record G002 source dogfood evidence for the 0.10.1 release | dogfood evidence artifact |
| 9 | `c4b9f2b24` | test(qa): record G004 defensive-copy gate evidence | QA gate artifact |
| 10 | `b5c4a7042` | feat: publish immutable release evidence | release evidence tooling |
| 11 | `a47dd8c5d` | test(qa): capture TUI render transcript for context-usage surfaces | TUI transcript artifact |
| 12 | `09dac1734` | test(qa): record round-4 SSOT QA evidence + CLI replay artifact | context-usage QA artifacts |
| 13 | `106a067ed` | docs(changelog): dedup #1908 and document IRC + other unreleased user-facing changes | package changelogs |

## 주제 분석

문서 수정과 QA artifact를 한 묶음으로 보는 이유는 release 설명이 실행 증거에서 다시 만들어져야 하기 때문이다. changelog는 한 변경을 한 번만 말해야 하고, PTY·CLI replay·JSON report는 해당 문구를 재검증할 수 있어야 한다. SDK guide는 public API와 실제 package surface를 따라가야 한다.

## model/ 교차 참조

직접 model-related 변경은 없다. context-usage QA artifact는 모델별 usage 동작을 포함할 수 있지만 이 클러스터의 대상은 모델 정책이 아니라 증거 포맷과 재현성이다.

## Worktree 대조

upstream의 `docs/sdk-app-guide.md`와 주요 QA artifact는 현재 JWC에 같은 경로로 존재하지 않는다. JWC에서는 `structure/60_release_publishing.md`가 release source of truth이므로, artifact 보존 위치와 SDK guide 대상 독자를 먼저 정한 뒤 필요한 증거만 채택해야 한다.

