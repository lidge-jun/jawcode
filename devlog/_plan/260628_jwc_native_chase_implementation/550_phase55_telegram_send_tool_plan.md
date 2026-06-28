# 550 Phase 55 plan — `telegram_send` model-visible tool (chase 10.034 gate 2, CLOSES card)

> Work-phase 55. Closes the last open done-gate of `10.034`: a connection-gated,
> workspace-confined `telegram_send` tool. C4 (model-controlled file egress) →
> independent audit before B, red-team path tests in C.

## Objective

Expose a model-visible `telegram_send` tool that sends a workspace-confined file to the
session's connected Telegram chat as a document/photo — but ONLY when the session has
connected Telegram notifications. Reuse the already-built + tested primitives:

- `resolveWorkspaceFileForNotification` (path confinement, phase 4) — gates 3+4.
- `renderAndSendTelegramMedia` (size/MIME policy + multipart dispatch, phase 53/54) — gate 1 egress.
- `getNotificationConfig` / `isNotificationEnabled` (token+chat source) — gate 2 connection.

## Done-gate status (10.034)

| gate | state | owner |
|---|---|---|
| 1 outbound image/file frames → sendPhoto/sendDocument | ✅ | phase 53/54 `renderAndSendTelegramMedia` |
| 2 `telegram_send` exists only when Telegram connected | **THIS PHASE** | new tool + createIf |
| 3 absolute/relative/symlink escape rejected | ✅ (reused) | `resolveWorkspaceFileForNotification` |
| 4 directories/missing rejected | ✅ (reused) | `resolveWorkspaceFileForNotification` |
| 5 inbound media paired-chat/known-topic only | ✅ | phase 54 route_media |
| 6 size/MIME documented or deferred | ✅ | phase 12 docs + `telegram-media-policy` |

Phase 55 closes gate 2 → all six met → CLOSE `10.034`.

## Design

### Connection gating (gate 2) — `TelegramSendTool.createIf(session)`
Return `null` (tool not discoverable) UNLESS BOTH:
1. `session.getNotificationServer?.() !== undefined` — this session actually started the
   loopback notification transport (the JWC-native "connected notifications" signal).
2. `isNotificationEnabled(getNotificationConfig(session.settings))` — enabled AND
   configured, which guarantees a `botToken` + `chatId` exist to send to.

Both hold → construct the tool. Either missing → `null`. No new setting; availability is
purely connection-derived, matching the gate wording.

### Execution — input `{ path: string; caption?: string }`
1. Re-resolve `config = getNotificationConfig(session.settings)`; defensive guard: if not
   enabled / missing token or chat → token-safe error (should be unreachable past createIf).
2. `decision = await resolveWorkspaceFileForNotification(session.cwd, input.path)`.
   On `!ok` → return a clear non-egress error keyed by `decision.reason`
   (missing_path / workspace_not_directory / file_not_found / outside_workspace /
   not_regular_file). NO bytes read, NO network.
3. `const data = await fs.readFile(decision.realPath)` (Uint8Array).
4. `const result = await renderAndSendTelegramMedia({ token, chatId, data,
   fileName: path.basename(decision.realPath), caption, fetchImpl })`.
   - `result.ok` → success: report method (sendPhoto/sendDocument), relativePath, sizeBytes.
   - `result.rejected` (size/MIME) → error `too_large`/`empty_file`, no egress occurred.
   - network `!ok` → token-safe `reason` (already sanitized by telegram-api).

### Token safety
The bot token is read from config, passed only into `renderAndSendTelegramMedia`, and NEVER
placed in tool input, output, or error text. telegram-api already sanitizes the token out of
every `reason`. The tool echoes only relativePath / fileName / sizeBytes / method.

### DI seam (tests, no live token)
`new TelegramSendTool(session, deps?: { fetchImpl?: typeof fetch })`. `createIf` passes none
(prod uses global fetch); tests inject a fake `fetchImpl` to (a) verify success mapping and
(b) assert it is NEVER called on a confinement rejection (egress-before-gate regression).

## Files
- NEW `packages/coding-agent/src/tools/telegram-send.ts` (~120 lines, ESM, try/catch at boundary).
- MODIFY `packages/coding-agent/src/tools/index.ts`: import, `telegram_send: TelegramSendTool.createIf`
  in `BUILTIN_TOOLS`, `export * from "./telegram-send"`.
- NEW `packages/coding-agent/test/tools/telegram-send-tool.test.ts`:
  createIf gating (no server → null; no config → null; both → tool);
  rejection red-team (absolute outside, relative `..` escape, symlink escape, directory,
  missing file) each asserts fetch NOT called;
  success (in-workspace file → sendDocument, fetch called once, no token in output);
  size policy reject (oversize → too_large, no egress).

## Verification (C)
- `bun test test/tools/telegram-send-tool.test.ts` (new).
- Full notifications + tools regression: `bun test test/notifications-*.test.ts
  test/notify-cli.test.ts test/tools/telegram-send-tool.test.ts`.
- `bun run check:types` exit 0; `bunx biome check --write` clean; `git diff --check`.

## Audit (A) — C4, independent read-only sub-agent
Challenge: (1) can the model reach any file outside cwd via the tool? (2) is the token ever
exposable in output/error? (3) is the tool truly hidden when notifications are not connected?
(4) does any rejection path egress before the gate? Verdict must be PASS + closeable before B.
