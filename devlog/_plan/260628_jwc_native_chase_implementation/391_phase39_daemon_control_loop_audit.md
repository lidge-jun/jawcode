# 391 Phase 39 audit — daemon control + loop (independent, read-only)

> Audits plan `390`. Verdict: **NARROW** — plan SOUND; card closure NOT yet justified → keep 10.030 OPEN.

## Confirmed
- `transportPaths(agentDir) → {dir, ownerFile, rootsFile}`; `control.json` at `dir` is consistent.
- `markTransportOwnerStopped(owner, now)` available for `onStop`.
- `DaemonTickResult.poll?.backoffMs` exists for loop sleep; `decideOwnerClaim` already provides
  wait-for-pid-death (defers to fresh-live owner, claims on dead/stale) → reload overlap prevented.
- `decideDaemonControl` table (no-request/no-owner/owner-mismatch/stale-request/honor) correct;
  loop reads control before tick (no race). No barrel name collisions.

## Correction applied
- `writePrivateJsonAtomic` is module-private → daemon-control mirrors the `0600` atomic
  write+rename+chmod pattern locally.

## Card-closure assessment (6 done-gates)
All 6 behavioral gates are met in deterministic, unit-tested logic across phases 2/37/38/39. BUT the
card's Verification asks for a "daemon smoke … if compiled" and Phase-2 Evidence + Decision E imply a
runnable long-lived process. The literal detached-OS-process / CLI spawn entrypoint is NOT provided by
any phase → **closing 10.030 now is not justified**. Keep OPEN; residual = spawn entrypoint + smoke
(phase 40).

PASS-to-build (NARROW), card stays open.
