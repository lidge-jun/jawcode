# 211 Phase 21 audit — pruning cap/protected output evidence

## Backend audit 1

Verdict: PASS.

The audit confirmed existing tests cover the `10.040-A` pruning cap/protected-output behavior:

| `10.040-A` behavior | Evidence file | Coverage |
|---|---|---|
| Pruning cap / protected output | `packages/agent/test/pruning-redteam.test.ts` | Protect-window accumulation and `minimumSavings` gating. |
| Protected read / skill | `packages/agent/test/pruning-redteam.test.ts`; `packages/agent/test/pruning-staleness.test.ts` | `read`/`skill` protection and non-overridable skill behavior. |
| Stale read override | `packages/agent/test/pruning-staleness.test.ts`; `packages/agent/test/pruning-staleness-redteam.test.ts` | Stale reads pruned; newest read per file protected. |
| Newest-output protect window | `packages/agent/test/pruning-redteam.test.ts`; `packages/agent/test/pruning-staleness.test.ts` | Newest outputs kept while older eligible outputs prune. |
| `minimumSavings` boundary | `packages/agent/test/pruning-redteam.test.ts`; `packages/agent/test/pruning-staleness.test.ts` | Strict below threshold, inclusive at threshold. |
| Digest cap | `packages/agent/test/pruning-redteam.test.ts` | Bash/search/grep digest notices remain bounded and `tokensSaved` uses notice length. |
| Cache-epoch pruning boundary | `packages/coding-agent/test/pruning-cache-epoch.test.ts` | No pruning below compaction threshold; pruning allowed at maintenance boundary. |

Verification run by auditor:

```text
bun test packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness-redteam.test.ts packages/coding-agent/test/pruning-cache-epoch.test.ts
47 pass, 0 fail
```

Typecheck run by auditor:

```text
cd packages/agent && bun run check:types
cd packages/coding-agent && bun run check:types
```

Both exited 0.

Soft gap noted:

- No single test calls `pruneToolOutputs(..., DEFAULT_PRUNE_CONFIG)` with production-sized 40k/20k fixtures. The auditor classified this as non-blocking because the suite covers the underlying behaviors parametrically and asserts the default config shape.

Decision:

- Proceed as a no-runtime-code evidence-hardening phase.
- Do not add a new test unless B-phase local reruns reveal a concrete gap.
