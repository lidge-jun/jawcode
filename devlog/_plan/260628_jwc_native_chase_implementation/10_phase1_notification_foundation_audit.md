# 10 Phase 1 audit — notification foundation

## Plan audit verdicts

| Reviewer | Initial verdict | Final verdict | Notes |
|---|---|---|---|
| Backend | NEEDS_FIX | PASS | Required GJC-aligned EndpointRecord, root schema path, enum settings shape, env resolver contract, status JSON shape, and permissions. |
| Docs | NEEDS_FIX | PASS | Required PABCD evidence artifacts, chase close mapping, discovery shape, schema checks, and explicit active-card policy. |

## Plan fixes applied before build

1. Discovery record aligned to GJC `EndpointRecord` field names while keeping `.jwc` state path.
2. Generated schema path corrected to `schemas/config.schema.json`.
3. `notifications.verbosity` specified as JWC enum with `values: ["lean", "verbose"] as const`.
4. `jwc notify` placement specified in `baseCommands`.
5. GJC copy boundaries specified: no `daemon-internal`, no Telegram fetch, no natives import.
6. Existing `assertSafeSessionId()` reuse required.
7. Token and chat masking contracts specified.
8. Protocol subset limited to minimal SDK wire discriminators.
9. `$resolveEnv("GJC_*")` dual-read contract specified with JWC hardening: token-only/incomplete env does not enable notifications.
10. Discovery directory `0700` and file `0600` required.
11. Status JSON shape and PABCD artifact paths specified.

## Build authorization

After the final Backend and Docs PASS verdicts, this phase proceeded to implementation.
