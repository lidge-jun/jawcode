# 01 source audit matrix

| source | current head | comparison | immediate concern |
|---|---|---|---|
| GJC | `a791d72a` upstream/dev | `498d86bb..a791d72a` | 17 new non-Telegram cards exist but many are template-like and need stronger source facts. |
| GJC notifications | `a791d72a` upstream/dev | notification commits through `a791d72a` | Telegram stack exists as 10.028-10.035; verify no missing daemon/media/config sub-slice. |
| GJC `_fin` | JWC `_fin/10` | older closed evidence vs latest upstream | closed cards may need explicit follow-up pointers if upstream grew adjacent behavior. |
| OMP | `0fc6d136` origin/main v16.1.20 | post-15.13 through v16.1.20 | latest deltas are not yet split into new 20.009+ cards. |
| OMP `_fin` | JWC `_fin/20` | older 15.13 evidence vs v16.1.20 | old reference-only closures need stale-head review. |

## GJC cluster scaffold for Phase 1A-1C

| batch | card range | required evidence focus | known placeholder baseline |
|---|---|---|---|
| 1A | `10.028`-`10.035` | notifications SDK, notify CLI, Telegram daemon/topics/remote answers/session/media/docs | check for missing commit anchors beyond existing Telegram split |
| 1B | `10.036`-`10.045` | AI/auth/catalog, runtime, RPC, harness, compaction, TUI, goal, web search, plugins, computer-use | `plus ... cluster` appears in several cards and must be resolved |
| 1C | `10.046`-`10.052` | RLM, security, CI/release, perf, session/team, composer/toolcalls, docs integrations | `RLM/research-mode commit cluster` and `plus ... cluster` must be resolved |

## OMP pinned comparison range

| range | meaning |
|---|---|
| `cc0c67be` | OMP `v16.1.13` baseline already summarized by older chase docs |
| `0fc6d136` | OMP `v16.1.20` current source head |
| `cc0c67be..0fc6d136` | required source range for new `20.009`-`20.015` cards |

## OMP proposed card map

| card | focus | source path anchors to verify |
|---|---|---|
| `20.009` | append-only context integrity | `packages/agent/src/**`, `packages/agent/test/**` |
| `20.010` | AI OAuth and reasoning replay | `packages/ai/src/**`, `packages/catalog/src/**`, `packages/ai/test/**` |
| `20.011` | TUI image drafts and terminal edges | `packages/coding-agent/src/modes/**`, `packages/tui/**` |
| `20.012` | bash snapshot/env security | `packages/coding-agent/src/exec/**`, `crates/pi-shell/**`, bash tests |
| `20.013` | plugin virtual registry/bundle | `packages/coding-agent/src/extensibility/**`, plugin bundle tests |
| `20.014` | goal compaction/provider concurrency | `packages/agent/src/compaction/**`, `packages/coding-agent/src/session/**` |
| `20.015` | release/test leak hardening | `.github/**`, `packages/*/test/**`, release/build scripts |
