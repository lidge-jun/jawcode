# 11 Phase 1B — GJC core active card hardening

## Scope

Harden GJC core active cards `10.036` through `10.045` only.

## Pre-edit stale phrases

Current cards contain vague cluster wording in these places:

- `10.037`: `plus later lifecycle fixes`
- `10.038`: `plus issues/ RPC series`
- `10.039`: `plus harness/receipt issue cluster`
- `10.040`: `plus pre-prompt maintenance commits`
- `10.042`: `plus deep-interview/ultragoal cluster`
- `10.043`: `plus search/read URL cluster`
- `10.044`: `plus plugin/migration cluster`
- `10.045`: `plus computer/control readiness cluster`

`10.036` and `10.041` already have concrete enough cluster lines but may receive a Phase 1B note if touched by source evidence.

## Source evidence buckets

- Runtime/process lifecycle: `ac519ac4`, `7cb64d92`, `495f7076`, `d38e9326`, `b1e672fe`, `d952987b`, `246d23d1`, `5d1c2ef5`, `8de3e154`, `13e40b2c`, `61987828`, `d510f817`.
- RPC control plane: `5d2a1809`, `45f70618`, `92ddf3fb`, `679ab5ba`, `251ea268`, `ff0e7eb4`.
- Harness/receipt: `287a959e`, `e5fa1a5b`, `671e20d5`, `7495682b`, `f8144130`, `75d103f4`, `22cbc7a0`.
- Compaction/memory: `534b4f0a`, `5283f4e6`, `874413ac`, `f2e98046`, `91c793eb`, `6aad24b3`, `128cfc6b`, `94090952`.
- Deep-interview/ask/goal state: `2724108d`, `206ea7ef`, `18db6df8`, `39229246`, `5bcf585c`, `16a87445`, `b316a1c7`, `e20f5ad9`, `93043d3f`, `e0e72e74`, `8989da5d`, `1ee91a7e`, `616bfa60`, `e19749ff`, `e341b495`.
- Web search/read URL: `638d2f11`, `6527ee01`, `9f0aa418`, `46ad9dc6`, `7a9b53a9`, `5554ffd1`, `70173544`, `1380d4ae`, `d90c7a8f`, `e49d93f8`, `4cc65051`, `730e00b3`, `e8baec13`, `42a00dbe`, `6a1cb18c`, `0471c35d`.
- Plugin/extensibility: `fe6decae`, `56865418`, `95ee49a6`, `4a972aa7`, `211bec6c`, `d83eb0dd`, `c6386f27`, `101562cf`, `c401f526`, `3155f038`, `31b704e9`, `19a6d9bb`, `8caa7793`, `7408bcd9`, `419f2058`.
- Computer-use/native control: `ddf50634`, `a3967ff3`, `8d0d1b31`, `d0896b68`, `59f376e2`, `3ae89895`, `a7be3da1`, `427c023c`, `581cf61a`, `e64ee41b`, `448b8042`.

## Per-card replacement table

| card | stale phrase | replacement policy |
|---|---|---|
| `10.037` | `plus later lifecycle fixes` | Preserve existing anchors and append the runtime/process lifecycle bucket. |
| `10.038` | `plus issues/ RPC series` | Preserve existing anchors and append `5d2a1809`, `45f70618`, `251ea268`. |
| `10.039` | `plus harness/receipt issue cluster` | Preserve existing `287a959e`, `94596645`; append harness/receipt bucket. |
| `10.040` | `plus pre-prompt maintenance commits` | Preserve existing anchors and append compaction/memory bucket. |
| `10.042` | `plus deep-interview/ultragoal cluster` | Preserve existing anchors and append deep-interview/ask/goal bucket. |
| `10.043` | `plus search/read URL cluster` | Preserve existing anchors and append web-search/read URL bucket. |
| `10.044` | `plus plugin/migration cluster` | Preserve existing anchors and append plugin/extensibility bucket. |
| `10.045` | `plus computer/control readiness cluster` | Preserve existing anchor and append computer-use/native-control bucket. |

The blockquote `Upstream cluster` and the `source commits` table row must stay textually synchronized on every modified card.

## Planned edits

- Replace the stale phrases listed above with exact SHA lists according to the per-card replacement table, preserving existing valid anchors rather than overwriting them.
- Add `## Phase 1B Hardening Note` to each modified card `10.037`, `10.038`, `10.039`, `10.040`, `10.042`, `10.043`, `10.044`, and `10.045`.
- Keep `10.036` and `10.041` unchanged unless audit finds an issue.
- Do not edit 10.046+ in this phase.

## Verification

- `rg 'plus .*cluster|plus later lifecycle fixes|plus issues/ RPC series|plus .*commits|pre-prompt maintenance commits' struct_har/chase/10.03{6,7,8,9}_*.md struct_har/chase/10.04{0,1,2,3,4,5}_*.md` returns no match.
- A SHA-resolution gate succeeds: every SHA added to modified cards passes `git -C devlog/_gjc_chase/gajae-code cat-file -t <sha>`.
- `rg -l "Phase 1B Hardening Note"` over exactly the eight modified card paths returns `8`.
- `git diff --check` over the modified cards and this plan passes.
