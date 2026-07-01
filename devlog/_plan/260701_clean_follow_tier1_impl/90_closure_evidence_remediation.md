# 90 Closure evidence remediation — 10.056 / 10.057

## Scope

Stop-audit remediation only. No product code, no test harness changes, and no chase decision changes.

Lovelace found the 8-card clean-follow goal has no remaining product implementation work, but two already-closed card bodies do not explicitly record final `git diff --check` evidence even though the loop-level closure bundle requires it.

## Diff-level plan

### MODIFY

`struct_har/chase/_fin/10/10.056_gjc_chase_terminal_bell_notifications.md`

- In `Implementation Closure (2026-07-01)` verification evidence, add:

```sh
git diff --check
# exit 0
```

- Leave the card decision, implementation summary, tests, and residual-risk rows unchanged.

`struct_har/chase/_fin/10/10.057_gjc_chase_windows_hardening.md`

- In `Completion Evidence — 260701` verification block, add:

```sh
git diff --check
# exit 0
```

- Leave the card decision, implementation summary, tests, and deferred rows unchanged.

## Verification plan

```sh
rg -n -U "git diff --check\n# exit 0" struct_har/chase/_fin/10/10.056_gjc_chase_terminal_bell_notifications.md
rg -n -U "git diff --check\n# exit 0" struct_har/chase/_fin/10/10.057_gjc_chase_windows_hardening.md
git diff --check
bun run check:ts
```

## Acceptance criteria

- Both `10.056` and `10.057` _fin card bodies explicitly record final `git diff --check -> exit 0`.
- No product source files change.
- `git diff --check` and `bun run check:ts` pass after the documentation patch.
- Atomic remediation commit excludes unrelated untracked directories.
