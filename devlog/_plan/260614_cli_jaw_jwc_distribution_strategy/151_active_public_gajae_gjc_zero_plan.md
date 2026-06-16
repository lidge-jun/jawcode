# 151 — active public `gajae`/`gjc` zero preplan

## Objective

Extend the 150 visible-cleanup slice into a cross-repository public-surface
contract:

- active public Jawcode surfaces do not expose `gajae`, `Gajae-Code`,
  `@gajae-code`, `gaebal-gajae.dev`, `gjc`, or `GJC_*`;
- cli-jaw's embedded Jawcode runtime does not expose those strings through
  generated bundles, runtime adapters, docs, help text, errors, or remediation
  messages;
- historical lineage, MIT attribution, upstream snapshots, and compatibility
  readers remain allowed only in clearly marked legacy zones.

This is a preplan. It defines the patch sequence and gates; it does not perform
the runtime/package rename itself.

## Current evidence

Fresh repository scans show three distinct classes of remaining legacy identity:

| Class | Evidence | Required handling |
|---|---|---|
| public Jawcode docs | `README.md`, `README.jwc.md`, `structure/*.md`, `docs/*.md` still mention upstream/package-scope details | rewrite current-user docs; preserve lineage only in attribution or fork-delta sections |
| package/public metadata | root `package.json`, `packages/coding-agent/package.json`, `packages/jwc/package.json` still contain upstream names, URLs, bin aliases, descriptions, or dependency names | decide public vs internal package boundary, then clean publishable metadata |
| cli-jaw generated runtime | `/Users/jun/Developer/new/700_projects/cli-jaw/src/lib/tui/jawcode-*bundle*` contains upstream package metadata, URLs, `GJC_*`, `gjc` paths, plugin names, and stale onboarding text | regenerate from Jawcode after source cleanup; avoid manual bundle surgery |

## Policy

### Disallowed on active public surfaces

- `gajae`, `Gajae`, `Gajae-Code`, `gajae-code`, `@gajae-code`;
- `gjc`, `GJC`, `GJC_*`, `.gjc`, `gjc-*`;
- upstream URLs such as `gaebal-gajae.dev`, `gajae-ai/gajae-code`, and
  `can1357/gajae-code`;
- public install/help/error examples that teach users to run or configure the
  legacy name.

### Allowed with explicit classification

- `NOTICE.md`/license attribution;
- `_legacy/`, `_upstream_*`, `struct_har/gjc_origin/**`, and old devlog records;
- source compatibility readers, migrations, and aliases when they are not the
  preferred public name;
- minified local identifiers that are not strings shown to users;
- third-party vendored text outside Jawcode's product surface.

## Patch sequence

### 151-A — inventory guard first

Create a machine-readable guard before cleanup so the definition of "zero" does
not drift during edits.

Recommended implementation:

- add `scripts/check-public-legacy-zero.ts`;
- scan active public include roots in Jawcode:
  - `README*.md`, `CONTRIBUTING*.md`, `.github/**` templates;
  - `docs/**` except historical/rebrand-plan files;
  - `structure/**` except lineage sections allowlisted by marker;
  - `package.json`, `packages/*/package.json`, publish scripts, release scripts;
  - generated docs index and prompt/user-facing string roots;
- scan cli-jaw active include roots:
  - `src/agent/jwc-runtime.ts`;
  - `src/code-mode/**`;
  - `src/lib/tui/jawcode-tui-bundle.{js,mjs}`;
  - `src/lib/tui/jawcode-interactive-bundle.mjs`;
  - cli-jaw README/docs that mention the embedded Jawcode runtime;
- report every hit with category: `blocked`, `allowed-historical`,
  `allowed-compat`, or `allowed-vendor`;
- fail on any `blocked` hit.

### 151-B — Jawcode active docs and package metadata

Clean current-facing docs and publishable metadata before regenerating artifacts.

Expected edits:

- root private package name should stop presenting as `gajae-code` if it is
  visible through package tools; prefer `jawcode-workspace` for the private
  monorepo package;
- `packages/jwc` description should be Jawcode-first and mention lineage only in
  `NOTICE.md` or dedicated docs;
- user docs should say `jawcode` package, `jwc` bin, `jawcode/sdk` import;
- current structure docs should separate "active product surface" from
  "historical upstream lineage";
- download/schema/homepage/repository/bugs URLs should point to Jawcode-owned
  surfaces;
- plugin/MCP names should prefer `jawcode`/`jwc`; legacy names should be
  read-only aliases.

### 151-C — internal package-scope boundary

Do not silently conflate active public zero with full source namespace rename.
Make this decision explicit during implementation:

| Option | Meaning | Recommendation |
|---|---|---|
| 150-only | Keep `@gajae-code/*` imports if packages are private/bundled; hide from active public docs/bundles | acceptable for the first 150 cleanup if the guard proves they do not leak |
| 170 follow-up | Rename internal workspace scope to `@jawcode/*` or equivalent | preferred later if package metadata or generated bundles keep leaking |

If publishable package metadata still exposes `@gajae-code/*`, it is not purely
internal and must be handled in 150 or explicitly demoted from publish surface.

### 151-D — regenerate cli-jaw embedded runtime

cli-jaw cleanup depends on Jawcode producing clean artifacts.

Rules:

- regenerate `src/lib/tui/jawcode-*bundle*` from the cleaned Jawcode source;
- update cli-jaw adapters to prefer `JWC_*` env names and Jawcode wording;
- keep any compatibility mirroring in non-public helper code only;
- add or reuse a cli-jaw verification command that scans the embedded runtime
  bundle for blocked legacy strings;
- do not patch generated bundles by hand except for a temporary diagnostic diff.

### 151-E — verification bundle

Jawcode commands:

```bash
bun --cwd=packages/coding-agent run generate-docs-index
bun scripts/check-public-legacy-zero.ts
bun scripts/check-visible-definitions.ts
bun scripts/verify-g002-gates.ts
bun scripts/rebrand-inventory.ts --strict
bun test packages/coding-agent/test/default-gjc-definitions.test.ts packages/coding-agent/test/workflow-surface-orchestrate.test.ts
git diff --check
```

cli-jaw commands must be chosen after reading cli-jaw `package.json`, but the
minimum evidence is:

```bash
rg -n "gajae|Gajae|@gajae-code|gaebal-gajae|\\bgjc\\b|\\bGJC\\b" src/agent src/code-mode src/lib/tui/jawcode-*bundle* README.md docs structure
npm run build
```

The grep command is expected to become a scripted guard before final 150
completion so allowlists are reviewable and repeatable.

## Completion criteria

150 is complete only when:

1. Jawcode active public guard passes.
2. cli-jaw embedded Jawcode guard passes.
3. Any remaining legacy identity is confined to allowed historical/compatibility
   zones.
4. Generated bundle cleanup is reproducible from Jawcode source, not a one-off
   string replacement.
5. Local verification passes in both repositories.
6. Docs clearly say that inherited GitHub Actions workflows are absent and fresh
   release CI is a 160+ design task.

## Open implementation risks

- Full `@gajae-code/*` package-scope rename may exceed 150 if it touches every
  source import; do it only if public package metadata cannot be made clean
  otherwise.
- Legacy env readers are compatibility behavior; removing them outright risks
  breaking existing local state. Prefer public rename plus hidden alias until a
  migration slice removes them.
- cli-jaw has unrelated dirty work in code-mode/runtime files. Stage only files
  owned by the cleanup slice and do not overwrite unrelated changes.
