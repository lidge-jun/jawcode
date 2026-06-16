FAIL

[HIGH] pending-approval.md §G002+G006 verification, §1 acceptance criteria — `bun run check:tools` is not equivalent to `bun run ci:check:full`; it misses `check:node20-baseline`, `check:schemas`, and `check:jwc-ui`. — Replace local green/full verification references with `bun run ci:check:full` or enumerate all four sub-checks explicitly.

[HIGH] pending-approval.md §G004 `packages/jwc/package.json` — `scripts/` is absent from the package `files` field, so `scripts/postinstall-guard.cjs` would be excluded from the npm tarball and the postinstall hook would fail with ENOENT. — Make adding `scripts` to `files` an unconditional required step.

[HIGH] pending-approval.md §G003 darwin CI — proposed darwin PR/main smoke has no native addon provisioning strategy; `@gajae-code/natives` prebuilt availability is currently tag-gated for darwin. — Specify one strategy; recommended for this pass: limit darwin PR/main smoke to `--version`/`--help` only and document native `--smoke-test` as release/tag-gated until darwin prebuilt artifacts are published.

[MEDIUM] pending-approval.md §G002 test fix list — targets include tests not in `30_blockers.md` and omit known blocker clusters such as `btw-escape-dismiss.test.ts` and the GJC harness CLI timeout. — Make a fresh `bun --cwd=packages/coding-agent test --only-failures` reconciliation the first test-fix sub-step.

[MEDIUM] pending-approval.md §G002 — `packages/cu-mcp-server` zod 3 vs catalog zod 4 / TS version drift is documented in blocker/finding docs but omitted from the plan. — Add explicit sub-task to migrate to zod 4 + TS 6 or intentionally isolate with an override.

[MEDIUM] pending-approval.md §G005 docs inventory — adding a VitePress nav over the existing docs corpus risks orphaning existing docs. — Add a docs inventory/categorization step before writing `docs/.vitepress/config.ts`.

[MEDIUM] pending-approval.md §0 Decision Record — `bun install --frozen-lockfile passes` is locally true but misleading for CI until `bun.lock` is committed. — Clarify local pass vs CI cleanliness dependency.

[LOW] pending-approval.md §G005 VitePress dependency — version unspecified; VitePress 2.x may require Vite 6 while catalog pins Vite 5. — Pin `vitepress@1.x` or update the Vite catalog with compatibility analysis.

Most likely to break first: G003's darwin CI job, because adding `--smoke-test` without a darwin native addon path would create a permanent PR failure.
