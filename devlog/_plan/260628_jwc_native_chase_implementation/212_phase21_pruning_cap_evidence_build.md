# 212 Phase 21 build — pruning cap/protected output evidence

## Build summary

Phase 21 is a no-runtime-code evidence-hardening slice for `10.040-A`. Existing JWC pruning and session cache-epoch tests already cover the requested pruning cap/protected-output behavior, so no source or test implementation change was required.

## Evidence matrix

| `10.040-A` behavior | Evidence |
|---|---|
| Pruning cap / protect window | `packages/agent/test/pruning-redteam.test.ts` protects newest outputs and exercises newest-first protect-window accumulation. |
| Protected read / skill behavior | `packages/agent/test/pruning-redteam.test.ts` and `packages/agent/test/pruning-staleness.test.ts` prove protected `read`/`skill` behavior and non-overridable `skill`. |
| Stale read override | `packages/agent/test/pruning-staleness.test.ts` and `packages/agent/test/pruning-staleness-redteam.test.ts` prove stale reads are prunable while the newest read per file remains protected. |
| `minimumSavings` boundary | `packages/agent/test/pruning-redteam.test.ts` and `packages/agent/test/pruning-staleness.test.ts` prove strict-below and inclusive-at-threshold behavior. |
| Digest cap / savings accounting | `packages/agent/test/pruning-redteam.test.ts` proves bounded bash/search/grep digest notices and `tokensSaved` accounting against actual notice length. |
| Session cache epoch | `packages/coding-agent/test/pruning-cache-epoch.test.ts` proves pruning does not rewrite already-sent history below the compaction threshold and is allowed at the maintenance boundary. |

## Local verification

```text
bun test packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness-redteam.test.ts packages/coding-agent/test/pruning-cache-epoch.test.ts
47 pass
0 fail
174 expect() calls
```

```text
cd packages/agent && bun run check:types
$ tsgo -p tsconfig.json --noEmit
```

```text
cd packages/coding-agent && bun run check:types
$ tsgo -p tsconfig.json --noEmit
```

## Residual risk

This closes only the evidenced `10.040-A` pruning cap/protected-output subset. `10.040-B` resident cache lifecycle and `10.040-C` token accounting remain active.
