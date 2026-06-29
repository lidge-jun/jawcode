# 49 Phase 4 check — threaded surface local helpers

## Check record

## Focused tests

```sh
bun test packages/coding-agent/test/notifications-threaded-surface.test.ts packages/coding-agent/test/notifications-session-registry.test.ts packages/coding-agent/test/notifications-transport-shell.test.ts
```

Result: 15 pass, 0 fail.

## Type and diff checks

- `cd packages/coding-agent && bun run check:types` — pass.
- `git diff --check -- packages/coding-agent/src/notifications/threaded-surface.ts packages/coding-agent/src/notifications/index.ts packages/coding-agent/test/notifications-threaded-surface.test.ts struct_har/chase/10.031_gjc_chase_telegram_threaded_surface.md devlog/_plan/260628_jwc_native_chase_implementation/46_phase4_threaded_surface_local_plan.md devlog/_plan/260628_jwc_native_chase_implementation/47_phase4_threaded_surface_local_audit.md devlog/_plan/260628_jwc_native_chase_implementation/48_phase4_threaded_surface_local_build.md devlog/_plan/260628_jwc_native_chase_implementation/49_phase4_threaded_surface_local_check.md` — pass.

## Commit

Pending C-phase commit.
