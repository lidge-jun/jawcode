PASS

[INFO] pending-approval.md §G002/G006 — Prior CI gate mismatch resolved: verification now requires `bun run ci:check:full`, covering `check:tools`, `check:node20-baseline`, `check:schemas`, and `check:jwc-ui`, plus focused package typecheck.

[INFO] pending-approval.md §G004 — Prior npm tarball blocker resolved: `packages/jwc/package.json` change now unconditionally adds `scripts` to `files` with the postinstall hook.

[INFO] pending-approval.md §G003 — Prior darwin native provisioning blocker resolved: PR/main darwin smoke is constrained to native-independent `--version`/`--help`; native `--smoke-test` stays release/tag-gated unless a darwin addon provisioning path is added.

[INFO] pending-approval.md §G002/G005/§0 — Prior medium/low findings resolved: fresh `--only-failures` reconciliation is mandatory, cu-mcp zod/TS drift is explicit, docs inventory precedes VitePress config, local-vs-CI frozen-lockfile wording is corrected, and `vitepress@1.x` is pinned for Vite 5 compatibility.

Most likely to break first: G003 darwin CI smoke, if implementation accidentally enables native `--smoke-test` before darwin prebuilt provisioning exists.
