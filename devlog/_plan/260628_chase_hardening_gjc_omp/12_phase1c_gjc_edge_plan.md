# 12 Phase 1C — GJC reference/edge active card hardening

## Scope

Harden GJC active cards `10.046` through `10.052` only.

## Stale phrases to remove

- `10.046`: `RLM/research-mode commit cluster in 498d86bb..a791d72a`
- `10.047`: `plus auth-gateway/private-network/secret cluster`
- `10.048`: `plus release/runner cluster`
- `10.049`: `plus perf/bench/geobench corpus`
- `10.050`: `plus team/session/worktree cluster`
- `10.051`: `plus harmony/toolcall cluster`
- `10.052`: `plus docs integration commits`

## Source evidence buckets

- RLM/research mode: `4928f185`, `5ed80862`, `b64eb6ab`, `039692ab`, `087064ee`, `c6485758`, `aee80d60`, `a014edc6`.
- Security/privacy guardrails: preserve existing anchors and append `bbec0fb5`, `ec69fe36`, `0a265141`, `0471c35d`, `088fe7c3`, `8230b65c`, `79b387e8`, `d90c7a8f`, `1380d4ae`.
- Dev/CI/release packaging: preserve existing anchors and append `f6fbd957`, `0464f0f9`, `e56bd259`, `9c34e751`, `816aa07c`, `85af2a07`, `14137324`, `beddd221`, `641e9294`, `9f0f09fb`, `45d9f956`, `195d7f04`, `1e258255`, `7d390005`, `a256bdd7`.
- Performance/bench/corpus: preserve existing anchors and append `55d4ce43`, `78ed07c3`, `f40f0d66`, `977e8c61`, `057e7863`, `5cbc70ef`, `491d5226`, `42be38e4`, `94c563d3`, `0fdad46c`.
- Session/tmux/team/worktree: preserve existing anchors and append `050aa173`, `310a8fda`, `2302062a`, `269387ba`, `28e8573b`, `17a8193a`, `f4811752`, `91acea5b`, `9a8dc27a`, `5865991c`, `f747565f`, `5932f4b5`.
- Composer/toolcall integrity: preserve existing anchors and append `717cbada`, `a2477bf4`, `2b6b24cb`, `0d5abaf6`, `883e7f86`, `12e3dbc8`.
- Docs/external integrations: preserve existing anchors and append `b4a35367`, `ddf50634`, `c53828b6`, `651e1ab9`, `6f1b15d4`, `ba2e540e`, `79779768`, `53acb5df`, `4a972aa7`, `e5e922aa`, `83949d8d`, `70a11763`.

## Per-card replacement table

| card | stale phrase | replacement policy |
|---|---|---|
| `10.046` | `RLM/research-mode commit cluster in 498d86bb..a791d72a` | Replace with RLM/research-mode bucket. |
| `10.047` | `plus auth-gateway/private-network/secret cluster` | Preserve existing anchors and append security/privacy bucket. |
| `10.048` | `plus release/runner cluster` | Preserve existing anchors and append dev/CI/release bucket. |
| `10.049` | `plus perf/bench/geobench corpus` | Preserve existing anchors and append performance/bench/corpus bucket. |
| `10.050` | `plus team/session/worktree cluster` | Preserve existing anchors and append session/tmux/team/worktree bucket. |
| `10.051` | `plus harmony/toolcall cluster` | Preserve existing anchors and append composer/toolcall bucket. |
| `10.052` | `plus docs integration commits` | Preserve existing anchors and append docs/external integrations bucket. |

The `Upstream cluster` blockquote and `source commits` table row must stay synchronized on every modified card.

## Planned edits

- Replace stale phrases with concrete, resolving SHA lists.
- Add `## Phase 1C Hardening Note` to each modified card `10.046`-`10.052`.
- Preserve existing valid anchors and keep blockquote/source-commits rows synchronized.
- Do not touch GJC `10.028`-`10.045` in this phase.

## Verification

- Before build, Docs audit must verify every planned SHA resolves in GJC `a791d72a`; non-resolving security/docs candidates must be corrected before editing.
- After build, `rg 'commit cluster|plus .*cluster|plus .*commits|plus .*corpus|RLM/research-mode commit cluster'` over `10.046`-`10.052` returns no match.
- `rg -l "Phase 1C Hardening Note"` over exactly seven modified cards returns `7`.
- Every 8-character SHA in the modified cards resolves with `git -C devlog/_gjc_chase/gajae-code cat-file -t <sha>`.
- `git diff --check` over modified cards and this plan passes.
