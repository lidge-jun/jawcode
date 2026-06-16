# 07 — UDS Phase 2 decisions (all-in implementation)

> **Decision mode**: no remaining user product choices required for the first implementation pass.  
> **Owner decision**: implement UDS Phase 2 **in one sweep** on top of `dev`, with step docs below as the execution map.  
> **Scope lock**: UDS server + CLI flag + registry metadata + TS black-box tests + Python UDS client helper + docs/chase closeout.

## Fixed decisions

| Area | Decision | Rationale |
|---|---|---|
| Public CLI | `jwc --mode rpc --listen <socket-path>` | Matches upstream reference and the existing deferred docs. Avoid inventing `--rpc-listen` unless parser ambiguity appears during B. |
| Supported platform | Unix-domain socket on macOS/Linux; Windows returns explicit unsupported error when `--listen` is used | Current workstation and upstream path are Unix UDS. Silent fallback to stdio would hide bugs. |
| Default transport | stdio remains default for `jwc --mode rpc` and harness `JawcodeRpc` | Phase 1 stdio contracts and Python process client must not regress. |
| UDS ownership | One persistent RPC server process owns one socket path; it refuses to clobber live sockets and may remove stale socket files | Matches upstream `isUnixSocketAlive` guard and prevents cross-session theft. |
| Multi-client | Phase 2 acceptance covers **single active UDS client**. Multiple concurrent clients are explicitly not guaranteed beyond not crashing. | Upstream frame-sink pattern routes frames to active client; true fanout/request routing is a larger design. |
| Registry schema | Keep current Jawcode-compatible metadata: `transport?: "stdio" | "bridge" | "socket"`, `endpoint?: string`; UDS `--listen` uses `transport: "socket"` + `endpoint` | Backward compatible with existing TypeScript and Python registry readers; supersedes older draft wording that used `transport: "uds"` / `listenPath`. |
| Python scope | Add `RpcClient.connect_unix(...)` classmethod after server works; keep process-backed constructor unchanged | Completes a user-facing UDS path without disturbing stdio client startup or overloading constructor state. |
| 10.026 closeout | Move issue 09 to `server+client partial/fixed` according to Python helper coverage; keep 02–05 and 06–08 remaining rows open/deferred | Prevents scope inflation into unattended policy and full client parity. |
| Verification | Require both server black-box tests and existing stdio Phase 1 gates | UDS must prove additive behavior, not transport replacement. |

## Explicit non-decisions

These are **not** being decided in this cycle:

- No TCP listener.
- No Windows named pipe implementation.
- No multi-client fanout semantics.
- No daemon supervisor/lifecycle manager beyond the RPC process itself.
- No harness default migration from stdio to UDS.
- No claim that all `10.026` issues are fixed.

## Step document index

1. [08 — CLI + entrypoint wiring](./08_uds_phase2_step1_cli_entrypoint.md)
2. [09 — runtime UDS server](./09_uds_phase2_step2_runtime_server.md)
3. [10 — registry + Python client](./10_uds_phase2_step3_registry_python.md)
4. [11 — verification gates](./11_uds_phase2_step4_verification.md)
5. [12 — chase/docs closeout](./12_uds_phase2_step5_chase_closeout.md)

## Done definition

UDS Phase 2 is done only when:

- `jwc --mode rpc --listen <sock>` starts and emits `ready` to a UDS client.
- The UDS client can send JSONL commands and receive correlated responses.
- Live socket clobber is rejected; stale socket cleanup is safe.
- stdio RPC tests remain green.
- `jwc_rpc` can list the UDS-owned session and, if implemented in this cycle, connect through a Unix socket helper.
- `10.018`, `10.026`, and `02_issues_matrix_026.md` reflect the exact landed scope.
