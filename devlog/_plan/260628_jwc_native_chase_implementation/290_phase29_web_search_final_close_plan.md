# 290 Phase 29 plan — 10.043 web-search/read final close

## Goal

Close chase card `10.043` after verifying that its JWC-native web-search/read hardening slices are complete enough for the approved goal.

This phase is docs/status only. It does not add runtime behavior. The only remaining `10.043-B` resolver-context expansion is explicitly deferred because it would require a JWC search resolver API expansion, not a safe direct GJC logic port.

## Why this phase now

Phase 24, 25, and 26 already implemented and verified the concrete JWC-native hardening slices:

| Slice | Evidence |
|---|---|
| `10.043-A` | private/local URL read/fetch deny guards and redirect-hop validation |
| `10.043-B` | provider mapping guards for local registry aliases, with exact baseUrl-aware resolver-context guard deferred |
| `10.043-C` | Anthropic search error fail-closed behavior and citation/read regression evidence |

The active card still says `⬜` because the final closure audit has not reconciled those slices with the residual deferred resolver-context work.

## Planned file changes

### MODIFY `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`

Before:

```markdown
> MOC: [10_gjc_chase_MOC](./10_gjc_chase_MOC.md) · G1 · ⬜ · **P1**
...
Status: still active. This closes candidate slice `10.043-C`; the full card remains open only for the deferred `10.043-B` resolver-context expansion or an explicit reject/defer close decision.
...
| Decision F — residual risk | open until implementation or explicit rejection evidence exists. |
```

After:

```markdown
> MOC: [10_gjc_chase_MOC](../../10_gjc_chase_MOC.md) · G1 · ✅ **_fin** · **P1**
...
> Naming: upstream `gjc`/`.gjc` → JWC `jwc`/`.jwc` per [008](../../008_gjc_jwc_naming_contract.md).
...
## Done Gate

- [x] Source facts checked against `a791d72a` or a newer explicitly recorded GJC head.
- [x] JWC owner files listed before implementation.
- [x] Naming translation checked against [008](../../008_gjc_jwc_naming_contract.md).
- [x] Import/adapt/reject/split decision recorded for each sub-feature.
- [x] Focused test or explicit manual evidence proves the chosen behavior.
- [x] `git diff --check` passes for the patch.
- [x] MOC/follow-index/gap inventory updated if priority or status changes.
...
## JWC Phase 29 Final Close — 2026-06-28

Phase 29 closes `10.043` for the approved JWC-native goal.
...
Residual deferred work:

- Exact `provider: "openai"` + local OpenAI-compatible `baseUrl` denial remains future resolver-context API work owned by a future follow-up slice `10.043-D` or by a later `10.036` provider-context API phase if that API is expanded.
- DNS rebinding and post-resolution IP validation remain future network-policy work.
...
Status: final closed. Move to `_fin/10/`.
...
| Decision F — residual risk | closed for current JWC-native hardening goal; deferred resolver-context/network-policy work is not implemented and must open future `10.043-D` or a later audited provider-context slice before code. |
```

Also update moved-card relative links after relocation to `_fin/10/`:

- `./10_gjc_chase_MOC.md` -> `../../10_gjc_chase_MOC.md`
- `./008_gjc_jwc_naming_contract.md` -> `../../008_gjc_jwc_naming_contract.md`
- Done Gate `[008]` link -> `../../008_gjc_jwc_naming_contract.md`

Rewrite the three intermediate slice status lines from active wording to closed-subset wording:

- `10.043-A`: closed subset; Phase 29 final close verifies it with the other scoped slices.
- `10.043-B`: closed/deferred subset; Phase 29 verifies current provider-alias guards and records future `10.043-D`/provider-context ownership for exact local `baseUrl` denial.
- `10.043-C`: closed subset; Phase 29 final close verifies it with the other scoped slices.

### RENAME `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`

To:

```text
struct_har/chase/_fin/10/10.043_gjc_chase_web_search_insane_security.md
```

### MODIFY `struct_har/chase/10_gjc_chase_MOC.md`

Before:

```markdown
| 043 | [10.043_gjc_chase_web_search_insane_security.md](./10.043_gjc_chase_web_search_insane_security.md) | web-search/read URL hardening | **P1** | ⬜ |
```

After:

```markdown
| 043 | [10.043_gjc_chase_web_search_insane_security.md](./_fin/10/10.043_gjc_chase_web_search_insane_security.md) | web-search/read URL hardening | **P1** | ✅ _fin |
```

### MODIFY `struct_har/chase/007_follow_index.md`

Before:

```markdown
| U6 | 043 | [10.043 web-search/read URL hardening](./10.043_gjc_chase_web_search_insane_security.md) | **P1** | ⬜ |
```

After:

```markdown
| U6 | 043 | [10.043 web-search/read URL hardening](./_fin/10/10.043_gjc_chase_web_search_insane_security.md) | **P1** | ✅ _fin · phases 24-26, 29 |
```

### MODIFY `struct_har/chase/002_gap_inventory.md`

Before:

```markdown
| search/read URL hardening | ... | ... | [10.043](./10.043_gjc_chase_web_search_insane_security.md) |
```

After:

```markdown
| search/read URL hardening | ... | ... | [_fin/10.043](./_fin/10/10.043_gjc_chase_web_search_insane_security.md) |
```

Retarget the link and narrow the row wording so it does not imply the deferred exact local `baseUrl` resolver-context guard is implemented. The row should read as syntactic private-network read/fetch guards plus provider-alias/search citation hardening, with future resolver-context work tracked in the closed card's residual note.

### MODIFY `struct_har/chase/_fin/INDEX.md`

Add:

```markdown
| 10.043 | 10.043 — gjc chase: web search and public URL hardening | [10/10.043_gjc_chase_web_search_insane_security](./10/10.043_gjc_chase_web_search_insane_security.md) |
```

Change `_fin/INDEX.md` header count from `GJC _fin/10 = 26` to `GJC _fin/10 = 27`.

### FILL `devlog/_plan/260628_jwc_native_chase_implementation/291_phase29_web_search_final_close_audit.md`

Record Backend/Docs audit results.

### FILL `devlog/_plan/260628_jwc_native_chase_implementation/292_phase29_web_search_final_close_build.md`

Record exactly what was changed and why no runtime code changed.

### FILL `devlog/_plan/260628_jwc_native_chase_implementation/293_phase29_web_search_final_close_check.md`

Record fresh verification:

- focused web-search/read tests from phases 24-26,
- package typecheck,
- stale-link scan,
- scoped `git diff --check`,
- independent read-only verification.

## Verification plan

Run:

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

Run:

```bash
cd packages/coding-agent && bun run check:types
```

Run:

```bash
rg -n "\]\(\./10\.043|\]\(10\.043_gjc|struct_har/chase/10\.043_gjc" struct_har/chase
```

Expected result: no active-root stale link matches.

Run:

```bash
rg -n "\]\(\./10_gjc_chase_MOC|\]\(\./008_gjc" \
  struct_har/chase/_fin/10/10.043_gjc_chase_web_search_insane_security.md
```

Expected result: no moved-card internal links still using active-root `./` depth.

Run scoped diff check over all changed Phase 29 files, including:

```text
struct_har/chase/10_gjc_chase_MOC.md
struct_har/chase/007_follow_index.md
struct_har/chase/002_gap_inventory.md
struct_har/chase/_fin/INDEX.md
struct_har/chase/_fin/10/10.043_gjc_chase_web_search_insane_security.md
devlog/_plan/260628_jwc_native_chase_implementation/290_phase29_web_search_final_close_plan.md
devlog/_plan/260628_jwc_native_chase_implementation/291_phase29_web_search_final_close_audit.md
devlog/_plan/260628_jwc_native_chase_implementation/292_phase29_web_search_final_close_build.md
devlog/_plan/260628_jwc_native_chase_implementation/293_phase29_web_search_final_close_check.md
```

Re-run focused Phase 26 runtime diff scope if touched by accident:

```text
packages/coding-agent/src/web/search/providers/anthropic.ts
packages/coding-agent/src/web/search/types.ts
packages/coding-agent/test/web/search/anthropic-citations.test.ts
```

## Independent review

Dispatch read-only `Backend` or `Docs` verification after B:

- Verify the card relocation and `_fin` relative links.
- Verify `10.043-A/B/C` evidence is present and the remaining resolver-context work is not falsely claimed as implemented.
- Verify MOC/follow/gap/_fin index retargets.
- Verify no runtime source files changed in this docs/status close.

## Commit

Stage only Phase 29 chase/devlog files. Preserve unrelated dirty:

```text
devlog/.gitignore
devlog/_tmp/
```

Suggested commit:

```text
docs(chase): close web search hardening card
```
