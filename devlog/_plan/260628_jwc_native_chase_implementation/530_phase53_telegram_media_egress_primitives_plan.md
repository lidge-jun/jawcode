# 530 Phase 53 plan — Telegram media egress primitives (10.034 pass 1 of 2)

Card: `struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md` (C4, egress).
Prior slices: **A** workspace-path-confinement (phase 4), **B** media policy docs/tests (phase 12).
Upstream evidence only: `crates/gjc-notifications/src/protocol.rs` (ImageAttachment/FileAttachment),
`threaded-render.ts`, `tools/telegram-send.ts`.

## Two-pass close plan
- **Pass 1 (this phase, 53)** — egress *primitives*, no model-visible tool yet:
  - size/MIME policy classifier (gate 6 → enforced, not just documented);
  - token-safe multipart `sendTelegramPhoto` / `sendTelegramDocument` (gate 1 network half).
- **Pass 2 (phase 54)** — outbound frame render mapper (gate 1) + connection-gated `telegram_send`
  tool (gate 2) + inbound media routing paired-chat/known-topic only (gate 5); then CLOSE 10.034.

## This phase — files
- NEW `src/notifications/telegram-media-policy.ts` (~70 ln): `TelegramMediaDecision`,
  `classifyTelegramMedia({fileName, sizeBytes, declaredMime?})` →
  `{ method: "sendPhoto" | "sendDocument", caption? }` | `{ rejected, reason }`.
  Reasons: `empty_file`, `too_large`. Policy: photo exts {jpg,jpeg,png,webp} ≤ 10 MB → `sendPhoto`;
  oversize photo but ≤ 50 MB → `sendDocument`; any other file ≤ 50 MB → `sendDocument`; else `too_large`.
- MODIFY `src/notifications/telegram-api.ts`: add `sendTelegramPhoto` / `sendTelegramDocument` —
  multipart `FormData` POST (chat_id, optional message_thread_id, optional caption, file Blob+filename),
  token sanitized in error reasons, `fetchImpl` injectable for tests. Reuse `classifyTelegramError`.
- MODIFY `src/notifications/index.ts`: export telegram-media-policy.

## Tests
- NEW `test/notifications-telegram-media-policy.test.ts`: png→sendPhoto; 12MB png→sendDocument;
  20MB pdf→sendDocument; 60MB→too_large; 0 bytes→empty_file; uppercase ext normalized.
- EXTEND `test/notifications-telegram-api.test.ts`: sendDocument multipart success (assert method path,
  form fields, no token in any error), sendPhoto with caption, error path token-sanitized.

## Done-gate progress
gate 3 (path escape) + gate 4 (dir/missing) already met by confinement (phase 4); gate 6 moves from
"documented" to enforced here; gate 1 network half here. Gates 1(render)/2(tool)/5(inbound) → phase 54.

## Verification
`bun test test/notifications-telegram-*.test.ts` + full `notifications-*` regression + `check:types` +
biome + `git diff --check`. Independent C4 egress audit before B.
