# Dual-Install Shared-Surface Hardening (jwc + upstream gjc on one machine)

- Date: 2026-07-02 | Commits: 4f27be8, 87f7a8e, 4e0d302 | Class C3.
- Trigger: user runs BOTH jwc and upstream gajae-code; audit found three live/dormant
  shared surfaces.

## Shipped

1. **Migration guard** (4f27be8): `shouldSkipLegacyMigration()` — with an executable
   `gjc` on PATH, the one-time `.gjc`→`.jwc` rename is skipped (user root AND
   project-local) so live upstream state is never stolen. `JWC_NO_LEGACY_MIGRATION=1`
   always skips; `JWC_FORCE_LEGACY_MIGRATION=1` restores unconditional migration.
2. **Bin de-shadowing** (87f7a8e): coding-agent's `gjc` bin removed (runtime path is
   the `./cli` export via packages/jwc); `gjc-stats`→`jwc-stats`; dead `jawcode-compat`
   stub deleted; install:dev/dockerfile/run-ci now link `packages/jwc` (fixes the
   pre-existing link-vs-verify inconsistency); g002 rebrand gate asserts `jwc` on
   packages/jwc and rejects any coding-agent `gjc` bin.
3. **Env isolation + M4 gap** (4e0d302): opt-in `JWC_ISOLATE_LEGACY_ENV=1` stops
   GJC_* read-fallback and the JWC_→GJC_ load-time mirror (dual-install cross-talk:
   jwc inside a gjc tmux shell would adopt GJC_SESSION_ID/TEAM_STATE_ROOT);
   `GJC_TEAM_STATE_ROOT` — the last GJC_-only spawn writer — now dual-writes
   JWC_+GJC_ per the recorded 062.1 §6 M4 pattern.

## Deliberately NOT done (recorded boundaries honored)

- No blanket GJC_→JWC_ rename: fork-delta preservation boundary + 062.1 resolver
  design keep GJC_* as read-fallback for the two-release mixed-binary window.
- `@gjc-profile` tmux option value untouched (live cross-process persist contract).
- Two pre-existing gate FAILs (workspace version drift 1.1.2, ACP MCP handler +
  README legacy hit) belong to the in-flight release work — confirmed present with
  these changes stashed.

## Follow-ups

- When the 062.1 compat window closes: drop GJC_* fallback default, make isolation
  the default, and migrate `@gjc-profile` with a dual-read window.
- Consider defaulting `JWC_ISOLATE_LEGACY_ENV=1` when `shouldSkipLegacyMigration()`
  detects dual-install (one signal, two protections).
