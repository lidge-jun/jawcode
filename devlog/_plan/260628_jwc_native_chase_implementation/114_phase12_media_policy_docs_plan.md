# 114 Phase 12 plan — media policy docs/tests

## Work-phase

Implement `10.034-B`: media policy docs/tests that keep Telegram media/file transfer explicitly unsupported until a later runtime/security slice.

This slice is documentation and regression-test hardening. It does not add Telegram send/receive behavior.

## Source anchors

| Source | Evidence |
|---|---|
| Chase card | `struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md` |
| Split doc | `devlog/_plan/260628_jwc_native_chase_implementation/42_phase4_telegram_media_split.md` |
| Confinement slice | `devlog/_plan/260628_jwc_native_chase_implementation/55_phase4_workspace_path_confinement_plan.md` and `packages/coding-agent/src/notifications/workspace-path-confinement.ts` |
| Current onboarding docs | `docs/telegram-onboarding.md` |
| Current docs tests | `packages/coding-agent/test/notifications-docs.test.ts` |

## Allowed behavior

- Document that Telegram media/file transfer is not live.
- Document the future gates: workspace confinement, active authorized sink, MIME policy, size policy, no raw content/token/chat logging.
- Add docs tests that prevent accidental claims that `telegram_send`, `sendPhoto`, `sendDocument`, inbound media injection, or live media transfer are supported.
- Update `10.034` chase card with `10.034-B` docs/test evidence and keep the card active.

## Explicit non-changes

- No `telegram_send` tool.
- No Telegram Bot API calls.
- No `sendPhoto` or `sendDocument`.
- No inbound media attachment routing.
- No outbound frame schema.
- No MIME sniffing implementation.
- No file reading/sending beyond existing path-confinement tests.
- No generated schema/config changes.

## File plan

### MODIFY `docs/telegram-onboarding.md`

Add a `Media and files` section after the deferred list:

```md
## Media and files

Telegram media/file transfer is not implemented yet. JWC currently has only a local workspace path-confinement helper for a future file-egress path.

Do not document or automate `telegram_send`, `sendPhoto`, `sendDocument`, inbound Telegram media injection, or live attachment delivery as supported behavior.

Before any media/file runtime can ship, a later security-reviewed slice must prove:

- the selected file is realpath-confined to the active workspace;
- an active authorized Telegram sink is mapped to the current session;
- MIME and size policy are enforced before reading or sending bytes;
- logs never include raw file contents, bot tokens, chat ids, or full Telegram response bodies.
```

### MODIFY `packages/coding-agent/test/notifications-docs.test.ts`

Add a new test:

```ts
it("keeps Telegram media and file transfer documented as unsupported", async () => {
	const text = await readDoc("docs/telegram-onboarding.md");
	const lower = text.toLowerCase();
	expect(lower).toContain("media/file transfer is not implemented yet");
	expect(lower).toContain("workspace path-confinement");
	expect(lower).toContain("mime and size policy");
	expect(lower).not.toContain("telegram_send is supported");
	expect(lower).not.toContain("sendphoto is supported");
	expect(lower).not.toContain("senddocument is supported");
	expect(lower).not.toContain("inbound telegram media injection is supported");
});
```

### MODIFY `struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md`

Append `JWC Phase 12 Media Policy Evidence — 2026-06-28`:

- cite this devlog plan/build/check;
- cite `docs/telegram-onboarding.md`;
- cite `packages/coding-agent/test/notifications-docs.test.ts`;
- record that docs/tests close only `10.034-B`;
- keep `10.034` active because outbound frames, `telegram_send`, sink authorization, inbound media, MIME/size enforcement, and Bot API runtime remain open.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/115_phase12_media_policy_docs_audit.md`

Record Backend/Docs audit verdicts and fixes.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/116_phase12_media_policy_docs_build.md`

Record implementation and verifier results.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/117_phase12_media_policy_docs_check.md`

Record final check output and commit evidence.

## Acceptance criteria

1. Public docs say Telegram media/file transfer is not implemented yet.
2. Public docs do not claim `telegram_send`, `sendPhoto`, `sendDocument`, inbound media injection, or live attachment delivery as supported.
3. Public docs list future security gates for workspace confinement, active authorized sink, MIME/size policy, and log redaction.
4. Docs tests enforce the unsupported media claims.
5. `10.034` chase card records `10.034-B` evidence but remains active.

## Verification plan

```sh
bun test packages/coding-agent/test/notifications-docs.test.ts
cd packages/coding-agent && bun run check:types
git diff --check -- \
  docs/telegram-onboarding.md \
  packages/coding-agent/test/notifications-docs.test.ts \
  struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md \
  devlog/_plan/260628_jwc_native_chase_implementation/114_phase12_media_policy_docs_plan.md \
  devlog/_plan/260628_jwc_native_chase_implementation/115_phase12_media_policy_docs_audit.md \
  devlog/_plan/260628_jwc_native_chase_implementation/116_phase12_media_policy_docs_build.md \
  devlog/_plan/260628_jwc_native_chase_implementation/117_phase12_media_policy_docs_check.md
```

Employee verification:

- Docs: public wording and no overclaim.
- Backend/Security: confirm docs/tests do not imply runtime support and no code path changed.

## Commit plan

```sh
git commit -m "docs(notifications): guard telegram media policy"
```
