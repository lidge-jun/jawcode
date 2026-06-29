# 57 Phase 4 build — workspace path confinement

## Build record

Implemented files:

| File | Change |
|---|---|
| `packages/coding-agent/src/notifications/workspace-path-confinement.ts` | New pure path confinement helper using `fs.realpath`, `fs.stat`, and `path.relative` workspace containment. |
| `packages/coding-agent/test/notifications-workspace-path-confinement.test.ts` | New red-team tests for in-workspace files, invalid inputs, invalid workspaces, missing files, directories, relative/absolute escapes, symlink escapes, internal symlinks, and special files where supported. |
| `packages/coding-agent/src/notifications/index.ts` | Exported the new helper. |
| `struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md` | Added confinement-helper evidence while keeping done-gates open. |

Explicit non-changes:

- No `telegram_send`, Bot API call, outbound media send, inbound media routing, MIME/size policy, active Telegram sink, session authorization, or model-visible file tool.
- No `10.034` done-gate closure.
