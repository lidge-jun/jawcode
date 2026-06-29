# 303 Phase 30 check — 10.047 security/privacy guardrails final close

## Link / reference scan

```bash
rg -n "10\.047" struct_har/chase/007_follow_index.md struct_har/chase/10_gjc_chase_MOC.md \
  struct_har/chase/002_gap_inventory.md struct_har/chase/20.012_omp_chase_bash_snapshot_env_security.md \
  struct_har/chase/_fin/INDEX.md
```

Result: all 5 inbound references resolve to `./_fin/10/…` (or `./10/…` for `_fin/INDEX.md`).
Dangling open-dir scan `rg "\]\(\./10\.047" struct_har/chase/` → empty. Card present at
`struct_har/chase/_fin/10/10.047_…md`; open path `struct_har/chase/10.047_…md` gone. The moved
card's own links use `../../10_gjc_chase_MOC.md` and `../../008_…` appropriate for `_fin/10/` depth.

## Runtime evidence recheck (owned sub-slices A/B/C)

```bash
bun test packages/coding-agent/test/contribution-prep.test.ts \
  packages/coding-agent/test/agent-wire/event-observation.redteam.test.ts \
  packages/coding-agent/test/bash-executor.test.ts \
  packages/ai/test/auth-gateway-browser-origin.test.ts
```

```text
45 pass
0 fail
625 expect() calls
Ran 45 tests across 4 files. [7.32s]
```

## Type checks (goal constraint #8: no tsc)

```bash
cd packages/ai && bun run check:types          # tsgo -p tsconfig.json --noEmit → exit 0
cd packages/coding-agent && bun run check:types # tsgo -p tsconfig.json --noEmit → exit 0
```

## Diff check

```bash
git diff --check -- <staged chase docs + phase 300-303 docs>
```

Result: exit 0 (recorded at commit time; `.gitignore` / `_tmp/` left unstaged per constraint #7).

## Status

Phase 30 owned-lane closure verified: redaction (A) + env scrub (B) + browser-origin/no-auth (C)
all green, references reconciled to `_fin/10`, types clean. `10.047` is closed to `_fin` on
evidence rollup. Ready for independent read-only verification.
