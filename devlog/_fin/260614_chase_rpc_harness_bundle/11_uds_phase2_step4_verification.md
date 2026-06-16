# 11 — UDS Phase 2 step 4: verification gates

> **Goal**: prove UDS is additive, stdio remains stable, and Python/registry behavior matches the landed scope.

## Verification tiers

Because this touches RPC runtime, CLI parsing, registry, and Python client code, use **THOROUGH** verification for the final C stage.

## Required C gates

### 1. UDS-specific tests

```bash
bun test packages/coding-agent/test/rpc-listen-socket-guard.test.ts
bun test packages/coding-agent/test/rpc-uds-listen.test.ts
bun test packages/coding-agent/test/rpc-listen-platform.test.ts
```

Expected:

- live socket clobber rejected;
- stale socket cleanup accepted;
- UDS server emits ready to client socket;
- UDS client command receives correlated success response;
- invalid JSONL returns parse error frame, server survives, and a later valid `get_state` succeeds;
- spawned listen owner is discoverable with `transport: "socket"` + `endpoint`, and the registry record is reaped/removed after owner termination or documented in `14_uds_phase2_implementation_log.md`.

### 2. Phase 1 stdio regression bundle

```bash
bun test \
  packages/coding-agent/test/rpc-stdio-redteam.test.ts \
  packages/coding-agent/test/rpc-get-state-payload.test.ts \
  packages/coding-agent/test/harness-control-plane/receipts.test.ts \
  packages/coding-agent/test/harness-control-plane/receipt-spool.test.ts \
  packages/coding-agent/test/rpc-session-registry.test.ts
```

Expected baseline: same class of pass count as Phase 1 (`31 pass`) unless tests were intentionally added. Any stdio regression blocks D.

### 3. Python registry/client tests

```bash
python3 -m pytest \
  python/jwc-rpc/tests/test_registry.py \
  python/jwc-rpc/tests/test_client.py \
  python/jwc-rpc/tests/test_protocol.py \
  -q
```

If a new `test_client_uds.py` exists, include it explicitly:

```bash
python3 -m pytest python/jwc-rpc/tests/test_client_uds.py -q
```

### 4. CLI/parser smoke

Prefer unit tests if available. Otherwise capture command failures:

```bash
bun test packages/coding-agent/test/cli-command-surface.test.ts
bun test packages/coding-agent/test/rpc-listen-cli.test.ts
jwc --mode text --listen /tmp/jwc-rpc.sock
jwc --listen /tmp/jwc-rpc.sock
jwc --mode rpc --listen
jwc --help
```

Expected: invalid `--listen` forms reject cleanly with parser/mode errors and do not start interactive mode; `jwc --help` includes `--listen <path>` or `14_uds_phase2_implementation_log.md` records the actual help owner and output.

### 5. Type/check gate

Run after code/test changes:

```bash
bun run check:ts
```

If this is too broad for an intermediate B checkpoint, run targeted tests first and reserve `check:ts` for C.

## Redteam checklist

- [ ] Start UDS server on live socket path → refuses to clobber.
- [ ] Start UDS server on stale socket path → removes stale file and binds.
- [ ] UDS server accepts a client, emits `ready`, and handles newline-split partial frames.
- [ ] Invalid JSONL returns parse error frame and does not crash server.
- [ ] Client disconnect does not terminate server process.
- [ ] Subsequent client reconnect can issue `get_state`.
- [ ] stdio mode still emits `ready` on stdout immediately.
- [ ] stdio mode still reads stdin and writes stdout JSONL only.
- [ ] Registry stale PID cleanup unaffected.
- [ ] Python stdio client unaffected.

## Evidence bundle format

Create `14_uds_phase2_implementation_log.md` after C with:

```md
# 14 — UDS Phase 2 implementation log

## Changed files

- ...

## C evidence

```bash
<command>
<summary>
```

## Scope statement

- UDS server: landed
- Python UDS client: landed / deferred
- 10.026 issue 09 verdict: ...
- 02–05, 06–08: unchanged
- Goal ledger checkpoint: recorded with implementation, documentation, and verification evidence
```

## Block conditions

Do **not** update chase rows to complete if any of these are true:

- UDS works only via mocked unit test but no real socket smoke exists.
- Stdio regression bundle fails.
- Parser accepts `--listen` in non-rpc modes.
- Registry changes break old record parsing.
- Listen-owner process exits but remains listed as live in the RPC registry without documented stale-PID behavior.
- Python client changes break existing process-backed tests.
