# B5 — OAuth credential region hardening (runtime path)

SoT: opencodex `src/oauth/kiro-credentials.ts` (commits 4c97e0d "broaden single-account Kiro
credential inputs", 931847b "sanitize region and upstream error details", 68b079f "record OAuth
credential source safely"). The PABCD audit subagent noted jawcode's *runtime* auth lives in
`kiro.ts` (separate from the login-flow `utils/oauth/kiro.ts`) and lacked region validation, with a
region value flowing unvalidated into the refresh URL.

## Problem

jawcode's runtime auth threaded a `region` through the cache and into
`KIRO_REFRESH_URL.replace("{region}", region)`, but never validated it. A malformed or absent
region from an imported credential (SQLite / `~/.prokiro/auth.json`) produced a bad refresh URL,
causing refresh failures that surface as auth churn / repeated 401s. There was also no fallback to
the region embedded in the profile ARN.

## Fix (scoped to the runtime path)

- `normalizeKiroRegion(region)` — returns the value only if it matches the AWS region shape
  (`/^[a-z]{2}(?:-[a-z]+)+-\d$/`), else undefined. Rejects path-injection-y / cased values.
- `inferRegionFromProfileArn(arn)` — extracts and validates the ARN's region segment.
- `resolveKiroRegion(region, profileArn)` — explicit (validated) → ARN-inferred → `DEFAULT_REGION`.
- Both credential-read sites (SQLite, `~/.prokiro/auth.json`) now resolve region via
  `resolveKiroRegion`, and `refreshKiroDesktopToken` re-validates before interpolating the URL.

## Tests

- `kiro-region.test.ts` (4): region acceptance, malformed/injection rejection, ARN inference,
  garbage-ARN undefined.

## Deliberately out of scope

- The login-flow `utils/oauth/kiro.ts` keeps its hardcoded `us-east-1` refresh URL: that is the
  initial-login surface, region-agnostic by design, and not on the streaming stability path. A full
  port of opencodex's 256-line credential importer (enterprise SSO registration, `aws_sso_oidc`
  authType, structured diagnostics enum) is a larger login-surface change tracked separately; this
  phase closes the runtime refresh-URL correctness gap that drives sporadic auth errors.

## Verify

- `bun test packages/ai/src/providers/kiro-region.test.ts` — 4 pass, 0 fail.
- `bun run check:types` (packages/ai) — clean. biome format applied.
