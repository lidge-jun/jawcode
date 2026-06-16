# 190 — risks and stop conditions

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `jawcode` package unavailable at publish time | npm publish blocked | re-check registry before publish; reserve/own package before CI publish |
| package depends on unpublished workspace deps | user install fails | bundle standalone or intentionally publish every runtime dependency |
| cli-jaw shells out to global `jwc` | violates product goal | no-global-`jwc` PATH smoke |
| TUI-only Bun paths leak into cli-jaw server | Node import failure | `jawcode/sdk` must resolve to Node-compatible `dist-node` |
| standalone package assumes system Bun | first-run failure | managed Bun provisioning or bundled platform runtime |
| CI status rename breaks branch protection | blocked merges | compatibility-status transition |
| full namespace rename before stability | huge churn | defer internal scope cleanup |

## Stop conditions

Stop implementation and re-plan if any are true:

- `jawcode` package name cannot be owned or published;
- `jawcode/sdk` pulls in unsupported TUI/Bun-only runtime paths for cli-jaw;
- no-global-`jwc` smoke cannot be made deterministic;
- managed Bun provisioning cannot be made CI-safe and non-interactive;
- cli-jaw session ownership conflicts with JWC state ownership;
- branch protection cannot be updated and compatibility CI status is not feasible.
