# 150 — active public legacy identity cleanup slice

## Goal

Clean the active public contracts that would otherwise make a Jawcode/JWC
release look like the upstream identity it forked from.

The expanded 150 target is:

- **active public `gajae` zero**;
- **active public `gjc` zero**;
- the same rule applied to the cli-jaw embedded Jawcode runtime surface, not only
  the standalone Jawcode repository.

Historical lineage and compatibility internals can remain only when they are
explicitly marked as historical/legacy and are excluded from active public
release surfaces.

## Required before public release/default promotion

| Item | Action |
|---|---|
| docs/examples | Jawcode/JWC-first wording |
| package bin | `jwc` primary |
| package name | `jawcode` |
| package imports | `jawcode/sdk` |
| CI artifact names | JWC/Jawcode names; no inherited upstream workflow names |
| CI status names | no inherited upstream status names; fresh CI policy is a 160+ decision |
| coordinator MCP visible names | migration or compatibility aliases |
| generated bundles | cli-jaw embedded `jawcode-*bundle*` files rebuilt from clean Jawcode source |
| public URLs | `lidge-jun/jawcode` or future Jawcode-owned hosts, not upstream release/schema/homepage URLs |
| plugin manifests | Jawcode/JWC names, with read-only compatibility aliases if needed |
| env names | public docs and errors prefer `JWC_*`; `GJC_*` is compatibility-only and not active prose |

## Active public surfaces

These surfaces must be scanned and either cleaned or explicitly excluded by the
150 guard:

| Surface | Repo | Examples |
|---|---|---|
| landing docs | jawcode | `README.md`, `README.jwc.md`, `CONTRIBUTING.jwc.md`, issue/PR templates |
| maintained maps | jawcode | `structure/*.md`, non-legacy `docs/*.md` current user docs |
| package metadata | jawcode | root private package, `packages/jwc/package.json`, publishable package descriptions, homepage, repository, bugs, keywords |
| runtime user text | jawcode | help text, errors, remediation strings, onboarding packets, system-prompt prose |
| release/download URLs | jawcode | native download URLs, schema URLs, OpenRouter site/title headers |
| plugin/MCP names | jawcode | plugin file names, manifest keys, MCP visible defaults |
| embedded runtime | cli-jaw | `src/agent/jwc-runtime.ts`, `src/code-mode/**`, `src/lib/tui/jawcode-*bundle*` |

## Allowed legacy zones

`gajae`/`gjc` can remain in these zones only when the context is plainly
historical, compatibility-only, or upstream reference data:

| Zone | Reason |
|---|---|
| `NOTICE.md`, `LICENSE` | attribution and MIT lineage |
| `devlog/_plan/**/_legacy/**`, `devlog/_upstream_*`, `struct_har/gjc_origin/**` | historical/rebase evidence |
| explicit compatibility readers | migration and backward compatibility |
| internal generated minifier identifiers | non-semantic symbols only, never user text |
| lockfiles and vendored third-party code | not Jawcode public wording |

## Deferred

| Item | Reason |
|---|---|
| full internal `@gajae-code/*` source import rename | high churn; handle as a later internal namespace slice unless package metadata proves it is public |
| hard removal of legacy env readers | compatibility risk; public docs/errors should still prefer `JWC_*` |
| legacy state removal | migration risk |
| source internal constants | not required for active public zero unless they leak into user-visible text or generated bundles |

## Implementation shape

1. Add a strict active-public inventory guard before broad edits.
2. Clean Jawcode source and package metadata first.
3. Regenerate Jawcode distributable artifacts.
4. Update cli-jaw by consuming/regenerating the Jawcode bundle; do not hand-edit
   generated bundle strings with ad-hoc replacements.
5. Run both Jawcode and cli-jaw active-public guards before considering 150
   complete.

## Acceptance criteria

- new public docs teach `npm install -g jawcode` and `jwc`;
- release artifacts and generated bundle user text are JWC/Jawcode named;
- strict inventory passes for active public surfaces in both repositories;
- any remaining `gajae`/`gjc` hit is in an allowed legacy zone with an explicit
  reason;
- cli-jaw embedded Jawcode runtime has no active public legacy identity strings;
- remote CI is not a 150 blocker because inherited workflows were deleted; fresh
  CI/release policy belongs to 160+.
