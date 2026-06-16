# 050 — legacy identity cleanup timing

## Principle

Do not block 120/130 on a full internal rename. Remove legacy identity from public/current contracts first, preserve internal upstream-compatible implementation names only where packaging and embedding still need them.

## Two-sided cleanup map

| Surface | Clean before embedded cli-jaw? | Clean before standalone deploy? | Notes |
|---|---:|---:|---|
| `jwc` user bin | yes | yes | already the product command |
| package name | yes | yes | package must be `jawcode` |
| import surface | yes | yes | cli-jaw imports `jawcode/sdk` |
| docs/examples | yes | yes | active docs must be Jawcode/JWC-first |
| CI visible status/artifact names | before public release | before public release | prefer JWC/Jawcode names; use compatibility aliases only if branch protection requires them |
| coordinator MCP names | before default cli-jaw promotion if user-visible | not necessarily | migration plan needed |
| legacy env support | no | no | keep compat internally, add `JWC_*` mirrors where absent |
| legacy state discovery | no | no | migration/compat path |
| `@gajae-code/*` package scope | no | no | keep until standalone install strategy is stable |
| source internal constants | no | no | only change when tests and upstream sync burden justify it |

## Recommended timing

1. **Before 120**: active strategy docs and package/import contracts are Jawcode/JWC-first.
2. **During 130/140**: ensure standalone package exposes package `jawcode` and bin `jwc`.
3. **During 150**: rename CI artifact/status names and coordinator MCP names, or ship a compatibility bridge.
4. **After 160**: consider internal package scope rename only if upstream sync cost is no longer important.
