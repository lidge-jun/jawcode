# 60 GJC residual baseline cleanup

## Scope

Final synthesis identified three remaining `f0a8a3eb` references. This phase cleans up or contextualizes them so the chase corpus can be reviewed against GJC `a791d72a` without erasing historical implementation evidence.

## Planned edits

### MODIFY `struct_har/chase/003_reference_from_gjc.md`

Before:

```md
> **정본 클론**: `devlog/_gjc_chase/gajae-code/` · branch `dev` tracking `upstream/dev` · reviewed through **`f0a8a3eb`**
```

After:

```md
> **정본 클론**: `devlog/_gjc_chase/gajae-code/` · branch `dev` tracking `upstream/dev` · reviewed through **`a791d72a`** (2026-06-28 chase hardening)
```

### MODIFY `struct_har/chase/10.027_gjc_chase_goal_live_artifact_engine.md`

Before:

```md
> Reviewed source: GJC `f0a8a3eb` (`5bcf585c` #610) `gjc-runtime/ultragoal-runtime.ts`.
```

After:

```md
> Reviewed source: legacy engine anchor GJC `f0a8a3eb` (`5bcf585c` #610) `gjc-runtime/ultragoal-runtime.ts`; chase corpus rechecked through `a791d72a` (2026-06-28) with this split still deferred.
```

### MODIFY `struct_har/chase/_fin/10/10.012_gjc_chase_goal_steering.md`

Before:

```md
> Reviewed source: GJC `f0a8a3eb` steering subsystem (`ultragoal-runtime.ts`) vs JWC `0974e20` (port).
```

After:

```md
> Reviewed source: implementation anchor GJC `f0a8a3eb` steering subsystem (`ultragoal-runtime.ts`) vs JWC `0974e20` (port); historical `_fin` body rechecked against chase baseline `a791d72a` on 2026-06-28 with no body-status reopen.
```

## Non-goals

- Do not rewrite historical implementation facts in `_fin` as if they happened at `a791d72a`.
- Do not move `10.027` or `10.012` between active and `_fin`.
- Do not stage unrelated dirty files (`devlog/.gitignore`, `devlog/_tmp/`).

## Verification

- `rg 'reviewed through \\*\\*` verifies `003_reference_from_gjc.md` points to `a791d72a`.
- `rg 'f0a8a3eb' struct_har/chase` still allows the two contextual historical anchors but no stale unqualified reference remains in these three files.
- `git diff --check` passes for the plan and three chase docs.
- Independent Docs verifier checks that historical anchors are contextualized, not erased.
