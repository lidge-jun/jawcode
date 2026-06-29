# 92 Phase 9 split — 10.046 RLM research mode

## Source card

`struct_har/chase/10.046_gjc_chase_rlm_research_mode.md`

## JWC posture

Split upstream RLM behavior through JWC's existing `autoresearch` and web-search architecture. Do not add a duplicate `rlm` namespace unless a later product decision proves that JWC needs it.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| autoresearch state and storage | `packages/coding-agent/src/autoresearch/state.ts`; `storage.ts`; state tests |
| autoresearch command/resume flow | `packages/coding-agent/src/autoresearch/index.ts`; `command-resume.md`; `resume-message.md`; discovery/tools tests |
| research tools | `packages/coding-agent/src/autoresearch/tools/**`; `packages/coding-agent/test/autoresearch-tools.test.ts` |
| search/research providers | `packages/coding-agent/src/web/search/**`; `packages/coding-agent/test/web/search/**`; `packages/coding-agent/test/tools/web-scrapers/research.test.ts` |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.046-A` | RLM command-surface mapping to JWC `autoresearch`, including explicit reject/defer for duplicate namespace. | autoresearch discovery/state tests and docs. |
| `10.046-B` | Managed environment, resume, and autonomous gates for research runs. | autoresearch state/tools tests; fail-closed resume cases. |
| `10.046-C` | Live model e2e posture and error finalization using existing search/provider abstractions. | web/search tests and explicit no-secret/no-token evidence. |

## Reject/defer

- Adding `packages/coding-agent/src/rlm/**` by copying upstream.
- Creating a new public `rlm` command before deciding whether JWC should expose one.
- Running live-model or network e2e as a required local gate without stable credentials and opt-in semantics.

## Done-gate status

No `10.046` done-gate is closed by this split. The card remains active.
