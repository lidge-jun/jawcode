# 42 Phase 4 split — 10.034 Telegram media and file transfer

## Source card

`struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md`

## JWC posture

Treat as high-risk file egress/ingress. Path confinement and explicit unsupported-runtime docs may be built before any Telegram media send/receive or model-visible file tool.

## Adapt candidates

| Slice | Candidate | Allowed now | Required future tests |
|---|---|---|---|
| `10.034-A` | Workspace path confinement helper | Yes, pure helper for future file egress. | absolute path, relative path, symlink escape, directory, missing file |
| `10.034-B` | Media policy docs/tests | Yes. Document size/MIME/support status and guard docs against overclaims. | docs tests for no unsupported send/receive claims |
| `10.034-C` | Outbound frame schema | Maybe, only protocol type definitions with no network send. | type/serialization tests, no base64 bloat in logs |

## Reject for now

- A model-visible `telegram_send` tool before workspace confinement and active sink authorization exist.
- Sending any file outside the session workspace.
- Following symlinks outside the workspace.
- Accepting inbound Telegram media as user attachments before storage, scanning, and authorization policy exist.

## Defer

| Upstream behavior | Deferred until |
|---|---|
| `sendPhoto` / `sendDocument` | outbound Telegram runtime exists |
| active Telegram sink registry | endpoint connection/runtime exists |
| inbound media to user-message injection | attachment storage and safety policy exist |
| MIME allowlist and size enforcement | media policy PABCD |
| model-visible `telegram_send` | security review and confinement tests pass |

## Security constraints for later implementation

1. Resolve user-requested file paths with `realpath` and require `path.relative(workspaceRoot, realPath)` to stay inside the workspace.
2. Reject directories, missing files, special files, and symlink escapes.
3. Require an active authorized Telegram sink for the current mapped session.
4. Enforce size and MIME policy before reading or sending large files.
5. Never log raw file contents, bot token, chat id, or full external Telegram response bodies.

## Done-gate status after this split

No `10.034` done-gate is closed by this docs-only split. The card remains active.

