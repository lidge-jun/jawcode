# 01 Scope matrix — immediate, split-audit, held

## Immediate JWC-native cards

These cards may be implemented as JWC-native hardening or additive features. Each still needs a card-local plan before code edits.

| Card | Topic | First allowed posture | Primary risk |
|---|---|---|---|
| 10.028 | notifications SDK core | adapt by sub-slice | config/API boundary; ask/reply deferred |
| 10.029 | notify setup/status config | adapt | CLI/config UX |
| 10.030 | Telegram managed daemon | adapt with fail-closed guards | long-lived process, tokens |
| 10.031 | threaded Telegram surface | adapt | message routing, session identity |
| 10.032 | remote ask answers | adapt with explicit safety gates | remote input authorization |
| 10.033 | Telegram session lifecycle | pre-code split required | remote process control |
| 10.034 | Telegram media/file transfer | pre-code split required | file egress/ingress |
| 10.035 | notification adapters/docs | adapt | docs and release surface |
| 10.036 | AI provider/auth/model catalog | adapt | auth/model contract |
| 10.037 | runtime/process lifecycle hardening | adapt | process cleanup |
| 10.038 | RPC control plane v2 | adapt/split | control-plane security |
| 10.039 | harness receipts/phase rollup | adapt | evidence integrity |
| 10.040 | compaction/pruning/resident memory | adapt | context accounting |
| 10.041 | TUI/input/render/Windows psmux | adapt | TUI regressions |
| 10.042 | deep-interview/ask/goal state | adapt | workflow state |
| 10.043 | web-search/read URL hardening | adapt | network security |
| 10.044 | plugin/extensibility bundle | adapt/split | plugin boundaries |
| 10.045 | computer-use native control | adapt | desktop control safety |
| 10.046 | RLM/research mode | adapt/split | research-tool routing |
| 10.047 | security/privacy guardrails | adapt | security policy |
| 10.048 | dev/CI/release packaging | adapt | release gates |
| 10.049 | perf/bench/corpus | adapt | benchmark stability |
| 10.050 | session/tmux/team/worktree | adapt | team state |
| 10.051 | agent/composer/toolcall integrity | adapt | tool-call correctness |
| 10.052 | docs/external integrations | adapt | docs surface |
| 20.009 | append-only context integrity | adapt | transcript integrity |
| 20.015 | release/test leak hardening | adapt | CI/test hygiene |

## Split-audit first cards

These cards require a pre-implementation split note. The note must identify which sub-slices are JWC-native and which are rejected or deferred.

| Card | Topic | Why split-audit first |
|---|---|---|
| 20.010 | AI OAuth/reasoning replay | OAuth and reasoning replay can change auth semantics. |
| 20.011 | TUI image drafts/terminal edges | TUI changes can conflict with curated JWC visual behavior. |
| 20.012 | bash snapshot/env security | Security improvement is wanted early, but command/env semantics must be minimized before code. |
| 20.013 | plugin virtual registry/bundle | Plugin registry behavior may conflict with JWC bundled workflow rules. |
| 20.014 | goal compaction/provider concurrency | Goal/runtime concurrency touches existing JWC workflow invariants. |

## Held cards

These are not part of the immediate implementation goal.

| Card | Topic | Hold reason |
|---|---|---|
| 10.006 | TUI core | Broad curated UI risk; needs separate visual decision. |
| 10.019 | GC file lock | File-lock/TOCTOU work needs separate state and security plan. |
| 10.027 | goal live artifact engine | Product/security semantics need a separate decision. |
| 20.004 | LSP/DAP | Large feature family outside the approved JWC-native hardening scope. |

## Split policy

Inline split notes are allowed only for documentation-only cards or cards whose split affects no runtime behavior.

Runtime cards marked split need a written `*_split.md` artifact before code. This applies to `10.031`, `10.033`, `10.034`, and `20.010`-`20.014`.

`10.001` and `20.001` are cycle/fetch maintenance trackers and are outside this implementation scope.
