# 552 Phase 55 build — telegram_send tool

> Boss-direct build after audit `551` PASS (closeable). Closes 10.034.

## Changes
### NEW `packages/coding-agent/src/tools/telegram-send.ts` (~190 lines)
`TelegramSendTool implements AgentTool` — model-visible `telegram_send`:
- `static createIf(session, deps?)` → null unless `getNotificationServer()` present AND
  `isNotificationEnabled(getNotificationConfig(settings))` with botToken+chatId (gate 2).
- `execute({ path, caption? })`: re-guard config → `resolveWorkspaceFileForNotification(cwd, path)`
  (gates 3/4; on reject returns a clear non-egress error keyed by reason) → `readFile` →
  `renderAndSendTelegramMedia({ token, chatId, data, fileName, caption, fetchImpl })` (gate 1 +
  size/MIME policy). Token read from config, passed only to the sender, never in tool I/O.
- `TelegramSendToolDeps.fetchImpl` DI seam for token-free tests.

### MODIFY `packages/coding-agent/src/tools/index.ts`
Import `TelegramSendTool`; register `telegram_send: s => TelegramSendTool.createIf(s)` in
`BUILTIN_TOOLS`; `export * from "./telegram-send"`. `isToolAllowed` default (true) is fine —
the connection gate lives in `createIf`, which filters the tool out when it returns null.

### NEW `packages/coding-agent/test/tools/telegram-send-tool.test.ts` (11 tests)
createIf gating (no transport → null; no token → null; disabled → null; connected+configured →
tool); execute success (sendDocument, fetch called once, no token in output/details);
red-team rejections — absolute-outside, relative `../`, symlink escape, directory, missing file,
empty file — each asserts `fetch` was NEVER called (egress-before-gate regression).

## Verification handoff
C: tool tests + full notifications/tools regression + check:types + biome + diff-check. D: close 10.034.
