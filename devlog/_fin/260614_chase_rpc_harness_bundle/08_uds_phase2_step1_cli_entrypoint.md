# 08 — UDS Phase 2 step 1: CLI + entrypoint wiring

> **Goal**: make `jwc --mode rpc --listen <socket-path>` reach `runRpcMode(..., { listen })` without changing stdio behavior.

## Files

| File | Change |
|---|---|
| `packages/coding-agent/src/cli/args.ts` | Parse `--listen <path>` into a new parsed-args field, preferably `rpcListenPath?: string`. |
| `packages/coding-agent/src/commands/launch.ts` | Add help text for `--listen` only if the command help owns all global flags. |
| `packages/coding-agent/src/main.ts` | Validate mode/flag combination and pass `{ listen }` into `runRpcMode` for `mode === "rpc"`. |
| `packages/coding-agent/src/modes/rpc/rpc-mode.ts` | Signature accepts `options?: { listen?: string }`; actual server logic lands in step 2. |

## Parser contract

### Accepted

```bash
jwc --mode rpc --listen /tmp/jwc-rpc.sock
```

### Rejected

```bash
jwc --listen /tmp/jwc-rpc.sock
jwc --mode text --listen /tmp/jwc-rpc.sock
jwc --mode rpc-ui --listen /tmp/jwc-rpc.sock   # default recommendation: reject until deliberately supported
```

Error should be direct, e.g.:

```text
--listen is only supported with --mode rpc
```

## Implementation notes

1. Keep parser naming boring and explicit.
2. Do not overload existing `--session-dir` or registry paths.
3. Do not let `--listen` silently become a positional prompt.
4. Keep `@file` rejection for RPC/bridge modes unchanged.
5. `runRpcMode(session, uiContext)` call site becomes:

```ts
await runRpcMode(session, undefined, mode === "rpc" && parsedArgs.rpcListenPath ? { listen: parsedArgs.rpcListenPath } : undefined);
```

or equivalent, but keep `rpc-ui` behavior unchanged unless explicitly tested.

## Acceptance checks

```bash
jwc --mode rpc --help | true   # help should not crash
jwc --mode rpc --listen        # parser rejects missing value
jwc --mode text --listen /tmp/x.sock  # parser rejects invalid mode/flag combo
jwc --listen /tmp/x.sock             # parser/main rejects because --mode rpc is absent
jwc --help                           # global help includes --listen <path>
```

Programmatic/unit coverage is preferred over manual CLI checks if parser tests already exist.

## Regression risks

- A global parser may currently accept unknown flags as prompt text. Guard against that for `--listen`.
- `launch.ts` help and `cli/args.ts` parser can drift. Update both if one changes public help.
- `rpc-ui` has UI context; routing it through a single socket sink is not part of this step.

## Completion evidence

Record after implementation:

```text
B1 evidence: parser rejects invalid --listen usage; main passes listen path into runRpcMode only for --mode rpc.
```
