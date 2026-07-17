# 010_gjc_C14_ci_release_stabilization

> Range: `4a80bac9..3ddf26079`
> Cluster: C14 — CI/release stabilization
> Sol priority: P3
> Model-related: ✗
> Card target: 10.103_ci_release_stabilization
> Worker: GW7

이 클러스터는 affected-path 계산부터 SDK smoke, lifecycle fixture 격리, npm publish 검증까지 CI와 release의 실패 경계를 정리한다. 기능 변경이 아니라도 같은 head에서 재현 가능한 빌드와 검증을 만드는 커밋은 이 클러스터에 포함한다.

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `f98764831` | fix(ci): provision native addon for SDK package smoke | SDK package smoke |
| 2 | `36f67ca8d` | test(coding-agent): integrate managed lifecycle fixture scope | managed lifecycle fixture |
| 3 | `ac9e861d1` | test(coding-agent): use managed SDK fixture scope | SDK fixture scope |
| 4 | `3d8a2ac07` | chore(ci): use dev affected-path resolution | `scripts/ci-dev-affected.ts` |
| 5 | `5682ea726` | fix(ci): tolerate missing hosted merge base | affected-path merge-base |
| 6 | `b415db1aa` | ci: retrigger exact-head public sync gates | public sync gates |
| 7 | `8b639c430` | ci: make affected planning fail closed (#2401) | affected planning |
| 8 | `1e8e48bd1` | fix(release): address draft releases by id | GitHub release lookup |
| 9 | `9c7c02922` | ci: bound Main and Dev checks without SDK closure | branch CI gates |
| 10 | `f1683b9f2` | ci(dev): remove Windows notification atomicity gate | Windows dev CI |
| 11 | `5517a4e3e` | ci: shard affected build gates | affected build shards |
| 12 | `0a5098c9a` | fix(tests): retain exact SDK broker fixture owners (#2246) (#2265) | SDK broker fixtures |
| 13 | `c1805d1b6` | fix(gates): tolerate Bun Windows directory fsync EPERM (#2309) | Windows workflow gates |
| 14 | `148db5bd2` | ci(release): drop sdk_closure release gate, fix release_github_verify repo context | release workflow gates |
| 15 | `8132409c3` | test(release): cover bridge-client in tarball smoke package list | tarball smoke contract |
| 16 | `b2e632f83` | fix(ci): unblock 0.11.0 release gates | release gates |
| 17 | `f02f9f511` | fix(sdk): stabilize dev lifecycle shard (#2292) | SDK lifecycle shard |
| 18 | `86af502f1` | fix: make SDK v3 publish contract release-ready | SDK publish contract |
| 19 | `dae9a9ec0` | fix(sdk): prevent stale native addon shadowing (#2217) | SDK native addon loading |
| 20 | `774bc1677` | fix(release): retry npm latest-dist-tag lag on publish verify too | npm publish verification |
| 21 | `143d75353` | fix(release): tolerate npm registry propagation lag on publish verify | npm registry verification |
| 22 | `7ebdfcb5f` | fix(tui): reset shared stdout-error dispatcher between detach tests | TUI test isolation |
| 23 | `f36937c36` | fix(tui): make terminal-detach grace-timer tests robust under CI load | TUI CI timing |
| 24 | `321402147` | fix(release): make 0.10.2 CI-green | release validation |
| 25 | `796b5f8a5` | chore(release): prep 0.10.2 | release preparation |
| 26 | `ee814a467` | fix(ci): await goal context turn idle (#2209) | goal fixture settlement |
| 27 | `289134891` | fix(ci): format model profile tests (#2193) | model-profile test gate |
| 28 | `dd10bc093` | fix(ci): isolate merged-dev lifecycle fixtures (#2184) | lifecycle fixture isolation |
| 29 | `15f1691a7` | fix(ci): synchronize wall-clock timeout fixture (#2207) | timeout fixture |
| 30 | `6fae7cc54` | fix(ci): isolate ACP and GC fixtures (#2203) | ACP/GC fixture isolation |
| 31 | `d29da7afc` | fix(ci): repair current dev validation fixtures (#2200) | dev validation fixtures |
| 32 | `48320038b` | fix(ci): drain Slack lease recovery fixture (#2195) | notification fixture cleanup |
| 33 | `851f71a97` | fix(ci): format model profile tests (#2193) | model-profile test gate |
| 34 | `8670aa638` | fix(ci): isolate shard six lifecycle fixtures (#2186) | lifecycle shard isolation |
| 35 | `cf4d71086` | fix(ci): isolate merged-dev lifecycle fixtures (#2184) | lifecycle fixture isolation |
| 36 | `d83eec2f1` | fix(ci): isolate workflow gate ask fixture | workflow-gate fixture |
| 37 | `c6e53baac` | fix(ci): make notification replay durable | notification replay fixture |
| 38 | `c13a28e0f` | fix(ci): close remaining lifecycle races | lifecycle test races |
| 39 | `d7355a04d` | fix(ci): synchronize notification replay state | notification replay fixture |
| 40 | `fb98dd12b` | fix(ci): preserve notification startup identity | notification startup fixture |
| 41 | `a29288c33` | fix(ci): harden SDK lifecycle teardown | SDK lifecycle teardown |
| 42 | `fda6de381` | fix(ci): close lifecycle review gaps | lifecycle CI contract |
| 43 | `b43ebc464` | fix(ci): isolate shared lifecycle tests | shared fixture isolation |
| 44 | `41b378b55` | test(coding-agent): stabilize SDK broker heartbeat coverage | SDK broker heartbeat fixture |
| 45 | `b8480b721` | fix(ci): install dependencies in release_npm_publish before running ci-release-publish | release publish job |
| 46 | `61de84538` | fix: pin resolvable GitHub App token action | GitHub Actions dependency |
| 47 | `aeeed01d6` | fix: require release finalization receipt | release finalization gate |
| 48 | `a24016129` | chore(deps): pin @biomejs/biome to 2.5.2 for reproducible release | Biome toolchain pin |

## 주제 분석

변경은 세 층으로 나뉜다. 첫째, affected-path와 merge-base 계산을 fail-closed로 만든다. 둘째, lifecycle·notification·TUI fixture가 shard 간 상태를 공유하지 않도록 격리한다. 셋째, SDK tarball과 native addon을 실제 publish 순서로 smoke하고 registry 지연과 draft release를 명시적으로 처리한다.

## model/ 교차 참조

직접적인 model/provider 기능 변경은 없다. model-profile 테스트 formatting 커밋도 모델 의미 변경이 아니라 CI gate 안정화로 분류한다.

## Worktree 대조

JWC에는 `scripts/ci-dev-affected.ts`, `scripts/ci-release-publish.ts`, `.github/workflows/ci.yml`이 존재한다. 이 카드에서는 upstream workflow를 그대로 복사하기보다 JWC의 OIDC-first release 계약과 현재 package 목록을 기준으로 affected-path, smoke package, fixture owner를 대조해야 한다.

