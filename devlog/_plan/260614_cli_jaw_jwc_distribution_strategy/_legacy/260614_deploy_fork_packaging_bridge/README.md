# 260614 — GitHub deploy × jawcode fork × packaging bridge analysis

> 상태: 분석 완료. 사용자 요청: `searchengine` + `compact_hydration`을 `_fin`으로 이동하고,
> `github_deploy`, `jawcode_fork`, `packaging`을 묶어 현재 배포 전 병목을 재분류한다.

## 0. Housekeeping

Moved completed devlog folders:

- `devlog/_plan/260612_searchengine` -> `devlog/_fin/260612_searchengine`
- `devlog/_plan/260613_compact_hydration` -> `devlog/_fin/260613_compact_hydration`

Rationale:

- `260612_searchengine/000_moc_searchengine.md` declares completion with live
  smoke evidence.
- `260613_compact_hydration/README.md` documents the fixed hydration bug,
  root cause, target file, and linked commits.

## 1. Source Documents

| Band | Source | Relevant claim |
|---|---|---|
| GitHub deploy | `devlog/_plan/260613_github_deploy/00_moc_github_deploy.md` | deploy prep is CI blockers -> CI pipeline -> postinstall -> structure/README/Pages |
| GitHub deploy | `devlog/_plan/260613_github_deploy/50_p_stage_ultragoal_execution_plan.md` | five stories: stabilize dirty tree, green gates, CI, postinstall, docs site |
| GitHub deploy | `devlog/_plan/260613_github_deploy/56_a_stage_architect_delta_round2.md` | plan audit passed after adding CI/package/postinstall constraints |
| Packaging | `devlog/_plan/260613_packaging/00_moc_packaging.md` | remaining major item is automatic install script/postinstall |
| Packaging | `devlog/_plan/260613_packaging/20_audit_round2.md` | runtime external repo refs are 0; remaining external deps are binary/tool install concerns |
| Fork promotion | `devlog/_plan/260612_jawcode_fork/150_moc_promotion.md` | default-cli promotion requires parity gap, jwc default switch, rollback, P6 deferred flip cleanup |
| Fork promotion | `devlog/_plan/260612_jawcode_fork/150.1_parity_gap_matrix.md` | P6 blockers include gjc bins/status/artifacts/coordinator MCP naming |
| Auth/release | `devlog/_plan/260612_jawcode_fork/phase1/99.05.00_plan_auth_release_gate.md` | unscoped npm `jwc` is already occupied; remote update check is skipped until package target is settled |

## 2. Fresh Repo Facts

Observed on 2026-06-14:

| Fact | Current evidence | Implication |
|---|---|---|
| root package is still `gajae-code` and private | `package.json` `"name": "gajae-code"`, `"private": true` | public deploy target is not root package |
| public wrapper package is `jwc@0.1.0` | `packages/jwc/package.json` | conflicts with auth/release note that npm `jwc` is occupied by someone else |
| `packages/jwc` has no postinstall hook | `packages/jwc/package.json` scripts only `bundle`, `build:node` | GitHub deploy G004 and packaging outstanding item are not implemented |
| `packages/jwc` does not publish scripts | `files: ["bin", "dist"]` | planned `postinstall-guard.cjs` would be omitted unless `scripts` is added |
| workflows still expose `gjc-state-gates` | `.github/workflows/ci.yml`, `dev-ci.yml` job name/comment | fork P6 cleanup and branch protection naming are not done |
| CI has root `ci:check:full`, release/native scripts | root `package.json` scripts | CI infra exists but deploy plan still needs scope/name/package alignment |
| release-native job is tag-gated | `.github/workflows/ci.yml` `native_release` only on `refs/tags/v` | PR/main can stay light; release validation owns multi-platform native binaries |

## 3. Cross-Band Diagnosis

The three active bands are not independent:

1. **GitHub deploy depends on packaging.**
   - Deploy G004 is the same unresolved packaging item: safe/CI-aware
     postinstall, default config templates, optional tmux/cua-driver behavior,
     and published `scripts` files.
   - Until this exists, a GitHub release/npm install can pass source checks but
     still fail first-run onboarding.

2. **GitHub deploy depends on fork identity decisions.**
   - `packages/jwc/package.json` currently says `name: "jwc"`, but prior auth
     release notes say the npm `jwc` package is already occupied by another
     owner.
   - A deploy plan that publishes unscoped `jwc` is therefore unsafe; choose a
     scoped package or another package target before enabling publish/update
     checks.

3. **Fork promotion depends on CI/packaging names.**
   - `gjc-state-gates` remains in workflow visible status names.
   - P6 requires either renaming to jwc status/artifacts or explicitly running a
     dual-name transition with branch-protection changes.

4. **Packaging audit says source portability is mostly solved.**
   - Runtime external repo references are now 0.
   - Remaining risk is install-time dependency provisioning:
     `bun`, `git`, `tmux`, `@gajae-code/natives`, `cu-native`, optional
     `cua-driver`.

5. **Docs/Pages should not lead.**
   - Public docs can be published, but without package identity + postinstall +
     green gates they will document an install path that is not yet reliable.

## 4. Recommended Execution Order

### D0 — Decide package target before publish

Resolve the package name conflict first.

Options:

| Option | Pros | Cons |
|---|---|---|
| scoped package, e.g. `@jawcode/jwc` | safe namespace, avoids occupied `jwc` | requires docs/bin/update target rewrite |
| keep unscoped `jwc` only as local/bin wrapper | short command stays nice | cannot publish to npm safely unless ownership changes |
| publish under existing `@gajae-code/*` scope | easiest workspace compatibility | weak jawcode brand, contradicts public jwc-first direction |

Recommendation: publish package should be scoped; binary remains `jwc`.

### D1 — Stabilize current dirty tree and green gates

Use GitHub deploy G001/G002:

1. stage existing dirty work by functional bundle
2. run `bun install --frozen-lockfile`
3. run `bun run ci:check:full`
4. run focused package tests for failing clusters

Do not start postinstall implementation on top of an unclassified dirty tree.

### D2 — Implement packaging/postinstall

Merge GitHub deploy G004 and packaging MOC outstanding item into one slice:

- add `packages/jwc/scripts/postinstall-guard.cjs`
- add `packages/jwc/scripts/postinstall.ts`
- add `"postinstall": "node scripts/postinstall-guard.cjs"` to
  `packages/jwc/package.json`
- add `"scripts"` to `packages/jwc/package.json` `files`
- generate `~/.jwc/agent/mcp.json` and `settings.json` templates idempotently
- skip external installers in `CI=true` and safe modes
- tmux/cua-driver setup must be non-fatal
- skill deps remain opt-in

This is the highest value implementation slice because it closes both the
GitHub deploy and packaging bands.

### D3 — Align CI names and deploy scope

After D2:

- keep PR/main smoke native-independent (`--version`, `--help`)
- keep multi-platform native build release/tag-gated unless provisioning exists
- rename or dual-publish `gjc-state-gates` status before branch protection
  changes
- document release tag automation boundary (078-079)

### D4 — Fork promotion readiness

Only after D1-D3:

- complete `150.1` parity gap matrix
- handle P6 visible names: bins, CI artifacts/statuses, coordinator MCP names
- verify `rebrand-inventory.ts --strict`
- decide default CLI promotion separately from npm package publishing

### D5 — GitHub Pages and public docs

Docs site should be last in this bundle:

- inventory current `docs/`
- add VitePress config/scripts
- publish install docs only after package target + postinstall behavior are true

## 5. Minimal Next Slice

The smallest high-leverage next PR/commit stack:

1. Document package target decision in `260613_github_deploy` and
   `260613_packaging`.
2. Add `packages/jwc` postinstall guard + tests.
3. Add `scripts` to package `files`.
4. Add CI/safe-mode smoke commands.
5. Update deploy plan task tables to mark packaging/postinstall as the shared
   D2 blocker.

## 6. Stop Conditions

Do not push or publish until all are true:

- package target is decided and not pointing at an occupied npm package
- `bun install --frozen-lockfile` passes
- `bun run ci:check:full` passes
- focused postinstall tests pass
- `packages/jwc` tarball includes scripts/bin/dist as intended
- PR/main CI status names are compatible with branch protection
