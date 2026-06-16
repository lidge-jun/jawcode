# 12 — UDS Phase 2 step 5: chase/docs closeout

> **Goal**: after implementation and C gates, update chase state exactly to the landed UDS scope without overclaiming full 10.026 closure.

## Files to update after green C

| File | Required update |
|---|---|
| `devlog/_plan/260614_chase_rpc_harness_bundle/000_moc.md` | Mark UDS Phase 2 implemented and link `14_uds_phase2_implementation_log.md`. |
| `devlog/_plan/260614_chase_rpc_harness_bundle/02_issues_matrix_026.md` | Update issue 09 row; leave unrelated rows unchanged. |
| `devlog/_plan/260614_chase_rpc_harness_bundle/14_uds_phase2_implementation_log.md` | New evidence log with changed files, command outputs, residual scope, and goal-ledger checkpoint evidence. |
| `struct_har/chase/_fin/10/10.018_gjc_chase_rpc_registry_uds.md` | Change UDS row from deferred to landed/partial with exact evidence. |
| `struct_har/chase/_fin/10/10.026_gjc_chase_rpc_issues_audit.md` | Update issue 09 only; archived after user-directed `_fin` closeout despite residual rows. |
| `python/jwc-rpc/README.md` | If Python UDS helper lands, document connect flow. |

## Verdict language

Use one of these precise verdicts:

### Server-only landed

```md
| 09 | detached persistent session | UDS server **fixed** | client defer | Phase 2 server-only |
```

### Server + Python helper landed

```md
| 09 | detached persistent session | UDS server **fixed** | UDS helper **fixed** | Phase 2 |
```

### Partial due to missing reconnect/multi-client behavior

```md
| 09 | detached persistent session | UDS server **partial** | client **partial** | single-client UDS smoke only |
```

Do not write simply “fixed” unless both server and chosen client acceptance are green.

## 10.018 closeout wording

In `_fin/10/10.018...` update the Phase 1 table to include Phase 2 evidence, e.g.:

```md
| UDS `--listen` | ✅ Phase 2 | `rpc-uds-listen.test.ts`; `rpc-listen-socket-guard.test.ts` |
```

Keep a note:

```md
Multi-client fanout and Windows named-pipe support are out of scope.
```

## 10.026 boundaries

Rows that remain unchanged unless separately implemented:

- `02` enum validation — defer
- `03` negotiate scopes — defer
- `04` control vs tool budget — defer
- `05` mandatory floor — defer
- `06` contextUsage client parse — partial/open unless Python parser is fixed
- `07` handoff/login APIs typed client methods — open unless implemented
- `08` real-binary tests — open unless real-binary Python coverage lands

## Commit guidance

Preferred commit split if the working tree permits it:

1. `feat(rpc): add uds listen transport`
   - runtime + parser + TS tests
2. `feat(jwc-rpc): support uds client attach`
   - Python client + Python tests + README
3. `docs(chase): close rpc uds phase 2`
   - devlog + chase rows

If the user wants one dev-branch commit, keep the commit message explicit:

```text
feat(rpc): land UDS Phase 2 listen transport

Adds jwc --mode rpc --listen Unix-socket server, socket clobber guard,
registry UDS metadata, Python UDS attach helper, tests, and chase docs.
Keeps stdio RPC as the default transport.
```

## Final C evidence block template

```md
## C evidence

- `bun test packages/coding-agent/test/rpc-listen-socket-guard.test.ts`: ... pass
- `bun test packages/coding-agent/test/rpc-uds-listen.test.ts`: ... pass
- stdio regression bundle: ... pass
- `python3 -m pytest ...`: ... pass
- `bun run check:ts`: pass

## Residual scope

- multi-client fanout: deferred
- Windows named pipe: deferred
- 10.026 02–05, 06–08: unchanged unless listed above
```
