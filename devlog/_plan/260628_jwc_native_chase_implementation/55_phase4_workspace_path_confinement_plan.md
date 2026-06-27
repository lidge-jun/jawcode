# 55 Phase 4 implementation plan — workspace path confinement

## Scope

Implement `10.034-A`: a pure JWC-native workspace path confinement helper for future Telegram/media file egress.

This phase does not add `telegram_send`, Telegram network send/receive, attachment ingestion, MIME/size policy, active sink registry, or model-visible file tools.

## Source anchors

| Card | Source fact | JWC posture |
|---|---|---|
| `10.034` | GJC `telegram_send` resolves requested paths through `realpath` and rejects paths outside session cwd, missing files, directories, and symlink escapes. | Adapt only a reusable confinement helper and red-team tests. |
| `10.031` | Threaded classifier currently drops attachments. | Keep attachments unsupported until this helper and later media policy are complete. |

Mandatory naming contract: `struct_har/chase/008_gjc_jwc_naming_contract.md`.

## Risk class

C4 security-adjacent because this becomes the future guard before model-controlled file egress. The phase stays pure and local: no file reads beyond metadata/realpath/stat, no contents, no Telegram sink.

Required reviewers:

- Backend/security: path traversal, symlink escape, file type, and error-shape audit.
- Docs: chase/devlog evidence and no media-send overclaim.

## Exact file changes

### NEW

| File | Purpose |
|---|---|
| `packages/coding-agent/src/notifications/workspace-path-confinement.ts` | Resolve candidate file paths under a workspace root and return a safe file decision or bounded rejection reason. |
| `packages/coding-agent/test/notifications-workspace-path-confinement.test.ts` | Focused red-team tests for absolute/relative paths, symlink escape, directories, missing files, and safe output shape. |
| `devlog/_plan/260628_jwc_native_chase_implementation/55_phase4_workspace_path_confinement_plan.md` | This plan. |
| `devlog/_plan/260628_jwc_native_chase_implementation/56_phase4_workspace_path_confinement_audit.md` | A-phase audit record. |
| `devlog/_plan/260628_jwc_native_chase_implementation/57_phase4_workspace_path_confinement_build.md` | B-phase build record. |
| `devlog/_plan/260628_jwc_native_chase_implementation/58_phase4_workspace_path_confinement_check.md` | C-phase verification record. |

### MODIFY

| File | Planned change |
|---|---|
| `packages/coding-agent/src/notifications/index.ts` | Add `export * from "./workspace-path-confinement";`. |
| `struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md` | Add Phase 4 confinement helper evidence; keep done-gates open. |

## Planned API

```ts
export type WorkspaceFileRejectionReason =
	| "missing_path"
	| "workspace_not_directory"
	| "file_not_found"
	| "outside_workspace"
	| "not_regular_file";

export type WorkspaceFileConfinementDecision =
	| {
			ok: true;
			workspaceRoot: string;
			realPath: string;
			relativePath: string;
			sizeBytes: number;
	  }
	| { ok: false; reason: WorkspaceFileRejectionReason };

export async function resolveWorkspaceFileForNotification(
	workspaceRoot: string,
	candidatePath: string,
): Promise<WorkspaceFileConfinementDecision>;
```

Implementation rules:

0. Use ESM imports only: `import * as fs from "node:fs/promises"` and `import * as path from "node:path"`. Do not use `require` or default `fs/promises` imports.
1. Trim inputs; reject empty/whitespace `workspaceRoot` or `candidatePath` as `missing_path` before filesystem I/O.
2. Resolve `workspaceRoot` through `fs.realpath()`; on `ENOENT` or when `(await fs.stat(resolved)).isDirectory()` is false, return `{ ok: false, reason: "workspace_not_directory" }`.
3. Resolve absolute candidates directly; resolve relative candidates against the real workspace root.
4. Resolve candidate through `fs.realpath()` before confinement check.
5. Confinement check uses `path.relative(realWorkspaceRoot, realPath)` and rejects if relative starts with `..` or is absolute.
6. Reject candidate `ENOENT` as `file_not_found`.
7. Reject directories, sockets, devices, FIFOs, and other non-regular files as `not_regular_file`.
8. On success, set `sizeBytes` from `(await fs.stat(realPath)).size`; set `relativePath` to `path.relative(realWorkspaceRoot, realPath)`. The workspace root itself is not a valid file target.
9. Return only paths and size metadata; do not read file contents.
10. Decision JSON must not include file contents, bot tokens, chat ids, or external Telegram response data.
11. This helper must not import Telegram/runtime/session modules and must not perform network I/O.

## Rejection reason mapping

| Condition | `reason` |
|---|---|
| `workspaceRoot` or `candidatePath` is empty or whitespace-only after trim | `missing_path` |
| `workspaceRoot` fails `fs.realpath()` with `ENOENT` or resolves to a non-directory | `workspace_not_directory` |
| Candidate fails `fs.realpath()` / `fs.stat()` with `ENOENT` | `file_not_found` |
| `path.relative(realWorkspaceRoot, realPath)` starts with `..` or is absolute | `outside_workspace` |
| Candidate resolves but `!(await fs.stat(realPath)).isFile()` | `not_regular_file` |

## Explicit non-changes

- No `telegram_send` tool.
- No outbound `sendPhoto`/`sendDocument`.
- No inbound media attachment handling.
- No MIME allowlist or size limit yet; this helper returns `sizeBytes` for the later policy slice.
- No active sink/session authorization.
- Do not close `10.034`.

## Verification plan

Focused tests:

```sh
bun test packages/coding-agent/test/notifications-workspace-path-confinement.test.ts packages/coding-agent/test/notifications-threaded-surface.test.ts
```

Required `notifications-workspace-path-confinement.test.ts` cases:

- Relative file inside workspace resolves ok with bounded relative path.
- Absolute file inside workspace resolves ok.
- Missing file rejects `file_not_found`.
- Directory rejects `not_regular_file`.
- Symlink pointing outside workspace rejects `outside_workspace`.
- Symlink wholly inside workspace pointing at a contained regular file resolves ok.
- Candidate `../outside.txt` rejects `outside_workspace`.
- Absolute path outside workspace rejects `outside_workspace`.
- Empty or whitespace `candidatePath` rejects `missing_path`.
- Missing workspace root rejects `workspace_not_directory`.
- Workspace root that exists but is not a directory rejects `workspace_not_directory`.
- Named pipe or socket inside workspace rejects `not_regular_file` where platform-supported.
- Output JSON does not contain file contents or obvious token/chat substrings.

Type/static checks:

```sh
cd packages/coding-agent && bun run check:types
git diff --check -- packages/coding-agent/src/notifications/workspace-path-confinement.ts packages/coding-agent/src/notifications/index.ts packages/coding-agent/test/notifications-workspace-path-confinement.test.ts struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md devlog/_plan/260628_jwc_native_chase_implementation/55_phase4_workspace_path_confinement_plan.md devlog/_plan/260628_jwc_native_chase_implementation/56_phase4_workspace_path_confinement_audit.md devlog/_plan/260628_jwc_native_chase_implementation/57_phase4_workspace_path_confinement_build.md devlog/_plan/260628_jwc_native_chase_implementation/58_phase4_workspace_path_confinement_check.md
```

Expected commit:

```text
feat(notifications): add workspace path confinement
```
