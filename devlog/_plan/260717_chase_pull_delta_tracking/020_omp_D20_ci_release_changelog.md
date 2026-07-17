# 020_omp_D20_ci_release_changelog

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D20 — CI/release/changelog maintenance
> Sol priority: P3
> Model-related: no
> Card target: 20.070_ci_release_changelog
> Worker: OW10

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `9fd19696e` | version 17.0.1 bump | workspace manifests/locks/changelogs |
| 2 | `2c355102c` | merge 후 source를 Biome으로 재정렬 | agent/AI/coding-agent merged sources |
| 3 | `5e9d03f15` | union merge로 잘못 배치된 changelog entry 정규화 | package changelogs |
| 4 | `80adf274f` | flaky clipboard check CI 재실행 | CI clipboard gate |
| 5 | `d5cd24f39` | stale executor mock session과 spawn hint assertion 수정 | task executor tests |
| 6 | `d25d9300e` | prompt/session API 변경 뒤 남은 stale tests 수정 | coding-agent task/eval tests |
| 7 | `1c9291b6e` | version 17.0.0 bump | workspace manifests/locks/changelogs |
| 8 | `c2a659df3` | stale TUI/tool tests 수정 | settings and repaint tests |
| 9 | `34bfa9ad5` | package changelogs 재작성 | package changelogs |
| 10 | `55f5ebec4` | Python·metaharness sources 재포맷 | scripts/eval/metaharness |
| 11 | `7d02778c6` | version 16.5.2 bump | workspace manifests/locks/changelogs |
| 12 | `ff117fd10` | package changelog cleanup | package changelogs |
| 13 | `f2b70eeed` | farm fixes 반영 후 changelog 정규화 | package changelogs |
| 14 | `24a441e6b` | 추가 farm fixes 뒤 changelog 정규화 | package changelogs |
| 15 | `14b5da76a` | version 16.5.1 bump | workspace manifests/locks/changelogs |
| 16 | `eccf030a7` | TLDR changelog 정리 | package changelogs |
| 17 | `7ad94e99a` | changelog entries 정규화 | AI/coding-agent/utils changelogs |
| 18 | `a3960bb4e` | version 16.5.0 bump | workspace manifests/locks/changelogs |
| 19 | `c69c04836` | settings reset과 UI/TUI chunk 축소로 CI 안정화 | CI test runner |
| 20 | `883e68f2d` | dependency versions 및 patch mappings 갱신 | lockfile/package/patches |
| 21 | `6fcb1b300` | output·cleanup 형식에 맞춰 test expectations 동기화 | coding-agent tests |
| 22 | `01d3fc9b6` | version 16.4.8 bump | workspace manifests/locks |
| 23 | `f933f02fc` | version 16.4.7 bump | workspace manifests/locks |
| 24 | `b1c882e89` | VOUCHED list 갱신 | `.github/VOUCHED.td` |
| 25 | `20c0a2e41` | schema v6·느린 CI disk에 맞춰 storage tests 수정 | agent storage/tests |
| 26 | `12466ecf4` | version 16.4.6 bump | workspace manifests/locks |
| 27 | `3d1f9a4a3` | version 16.4.5 bump | workspace manifests/locks/changelogs |
| 28 | `a643e9446` | 중복 native/SDK/web-search tests 제거 | native/coding-agent tests |
| 29 | `d618577da` | package changelogs 갱신 | package changelogs |
| 30 | `d39a3ed45` | stale task/controller tests 수정 | coding-agent tests |
| 31 | `74be4d5f6` | advisor sources에 Biome formatting 적용 | advisor runtime/tests |
| 32 | `0835cde93` | advisor staleness fix changelog 추가 | coding-agent changelog |
| 33 | `5c56144f6` | VOUCHED list 갱신 | `.github/VOUCHED.td` |
| 34 | `cf1b3fc3f` | version 16.4.4 bump | workspace manifests/locks |
| 35 | `6bc4302f6` | coding-agent/natives changelogs 갱신 | package changelogs |
| 36 | `c893e7ab7` | 잘못 앞선 changelog 변경 되돌림 | AI changelog/test |
| 37 | `82645c5a6` | 16.4.3 changelog에 E2BIG bundle fix 기록 | coding-agent changelog |
| 38 | `f7930048d` | version 16.4.3 bump | workspace manifests/locks/changelogs |
| 39 | `d469064d1` | stale compile/plugin/docs-index tests 수정 | AI/coding-agent tests/build script |
| 40 | `529effac1` | contributor를 VOUCHED list에 추가 | `.github/VOUCHED.td` |
| 41 | `056fc5f69` | package changelogs 갱신 | package changelogs |

## 주제 분석

이 클러스터는 16.4.3에서 17.0.1까지의 release 경계를 만들고, 대규모 farm/union merge 뒤 changelog와 test contract를 다시 일치시킨다. 핵심은 개별 bump 자체보다 bump 사이에 반복되는 changelog 정규화, stale fixture 복구, CI isolation, dependency patch mapping 갱신이다.

OMP version과 VOUCHED 정책은 JWC에 직접 이식할 대상이 아니다. 반면 느린 disk에서의 storage test, test runner settings reset, UI/TUI chunk 크기, Bun build와 patch mapping은 JWC CI에서도 같은 실패 양상을 만들 수 있어 diff-level 검토 가치가 있다.

## Worktree 대조

현재 JWC package version은 1.1.2 계열이며 changelog는 각 패키지의 `[Unreleased]` 아래에 기록하는 별도 release 체계를 쓴다. 따라서 OMP의 16.x/17.x bump와 changelog 재배치는 기록 증거로만 유지한다.

JWC release는 OIDC-first workflow와 자체 검증 문서를 따른다. 카드에서는 version bump를 포트하지 않고, CI 안정화·build API·dependency patch mapping 중 JWC에 재현 가능한 항목만 골라야 한다. 현재 worktree의 changelog와 release 파일은 건드리지 않은 채 대조한다.
