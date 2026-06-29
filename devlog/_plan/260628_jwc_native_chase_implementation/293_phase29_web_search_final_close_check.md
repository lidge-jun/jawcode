# 293 Phase 29 check — 10.043 web-search/read final close

## B-phase local verification

Command:

```bash
bun test \
  packages/coding-agent/test/read-tool-group.test.ts \
  packages/coding-agent/test/fetch-private-network.test.ts \
  packages/coding-agent/test/tools/web-search-duckduckgo.test.ts \
  packages/coding-agent/test/web/search/anthropic-citations.test.ts \
  packages/coding-agent/test/tools/web-search-codex.test.ts \
  packages/coding-agent/test/web/search/xai.test.ts \
  packages/coding-agent/test/web/search/codex-broker.test.ts
```

Result:

```text
82 pass
1 skip
0 fail
157 expect() calls
Ran 83 tests across 7 files. [2.02s]
```

The skipped test is the existing opt-in DuckDuckGo live e2e.

Command:

```bash
cd packages/coding-agent && bun run check:types
```

Result: exit 0 (`tsgo -p tsconfig.json --noEmit`).

Command:

```bash
rg -n "\]\(\./10\.043|\]\(10\.043_gjc|struct_har/chase/10\.043_gjc" struct_har/chase
```

Result: exit 1 with no matches, expected for no active-root stale links.

Command:

```bash
rg -n "\]\(\./10_gjc_chase_MOC|\]\(\./008_gjc" \
  struct_har/chase/_fin/10/10.043_gjc_chase_web_search_insane_security.md
```

Result: exit 1 with no matches, expected for no moved-card internal root-depth links.

Command:

```bash
git diff --check -- \
  struct_har/chase/10_gjc_chase_MOC.md \
  struct_har/chase/007_follow_index.md \
  struct_har/chase/002_gap_inventory.md \
  struct_har/chase/_fin/INDEX.md \
  struct_har/chase/_fin/10/10.043_gjc_chase_web_search_insane_security.md \
  devlog/_plan/260628_jwc_native_chase_implementation/290_phase29_web_search_final_close_plan.md \
  devlog/_plan/260628_jwc_native_chase_implementation/291_phase29_web_search_final_close_audit.md \
  devlog/_plan/260628_jwc_native_chase_implementation/292_phase29_web_search_final_close_build.md \
  devlog/_plan/260628_jwc_native_chase_implementation/293_phase29_web_search_final_close_check.md
```

Result: exit 0.

## Independent verification

Backend verifier returned DONE and independently re-ran:

```text
bun test (7 files) -> 82 pass, 1 skip, 0 fail, 157 expect() calls
cd packages/coding-agent && bun run check:types -> exit 0
rg stale active-root 10.043 links -> exit 1, no matches
rg moved-card ./ depth links -> exit 1, no matches
git diff --check (scoped Phase 29 files) -> exit 0
```

The verifier also confirmed the exact `provider: "openai"` plus local OpenAI-compatible `baseUrl` guard, DNS rebinding, and post-resolution IP validation are not claimed as implemented.
