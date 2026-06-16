# PABCD cycle — PABCD-2 (state/manifest)

Phase doc: `03_pabcd_2_state_manifest.md`  
Session: `019ec6c2-3ce0-7000-814f-bc21cb4abac1`

## Scope

Verify write-side `plan`/`goal` in manifest + state runtime; read-side legacy slug normalize; **path precedence on disk deferred to PABCD-6**.

## Verification

```bash
bun test packages/coding-agent/test/workflow-state-command.test.ts
bun test packages/coding-agent/test/jwc-runtime/state-handoff.test.ts
bun test packages/coding-agent/test/jwc-runtime/state-integrity.test.ts
bun test packages/coding-agent/test/jwc-runtime/state-write-hardening.test.ts
```

## Acceptance

Manifest generated JSON lists `plan`/`goal`; `jwc state plan read` / `goal` write paths use canonical filenames (`planphase-state.json` for plan writer state is PABCD-3; mode-state is `plan-state.json` vs `planphase-state.json` — document: plan **workflow** mode file is `plan-state.json` per contract tests in ultragoal-runtime using `goal-state.json`).