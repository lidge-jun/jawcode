# 020 — G1 GJC chase-card coverage proof

## Scope

- Reviewed clone: `devlog/_gjc_chase/gajae-code` (read-only)
- Delta: `3ddf26079..baa4dc76`
- Rule: every non-merge delta hash appears either in one `10.108`–`10.117` anchor table or in the explicit no-card list below.
- Version-band check: anchor→`v0.11.5` = 290; `v0.11.5..v0.11.8` = 173; `v0.11.8..baa4dc76` = 66; total = 529.

## Card allocation

| card | theme | classification | bucket | cited |
|---|---|---|---|---:|
| `10.108` | security/network authority | adapt | C | 50 |
| `10.109` | session/storage migration | split | B | 83 |
| `10.110` | SDK/ACP/bridge lifecycle | adapt | A | 41 |
| `10.111` | workflow/interview/handoff/agents | split | C | 53 |
| `10.112` | notifications/Telegram/daemon | adapt | A | 59 |
| `10.113` | TUI/CLI/terminal interaction | adapt | C | 38 |
| `10.114` | AI/models/providers/retry | adapt | C | 51 |
| `10.115` | tools/search/memory/plugins | split | B | 33 |
| `10.116` | natives/Windows/platform | import | A | 16 |
| `10.117` | CI/release/docs/test evidence | evidence-fill | A | 83 |
| **total cited** | | | | **507** |

## Explicit no-card hashes

These 22 commits carry no independent behavioral chase unit: 17 are version-bump or bump-revert bookkeeping, four are format/import-order-only changes, and one deduplicates a release-note entry already covered by the release-evidence card's substantive anchors.

| hash | no-card reason |
|---|---|
| `03fb4a506dd1283cd1a9706ecc9487e4061bf0e5` | version bump |
| `1c3791d07c8fa3c1035be8a015d17f7237706b34` | release-note deduplication bookkeeping |
| `26dc40a11f54bcab5fbdf9f87af01ac9d56ea5ef` | version bump |
| `3aa3987a092c031dad7be56c5f5f22beb99c3dfe` | version bump |
| `42a6c632cd8af89194c715ccb89402ca782b711e` | version bump |
| `626d9a7c8ab7c72b1a6fd5195a053d62b209398c` | version-bump revert |
| `6468e6efa9aa6a28e5ec89802230843ec6d563fa` | import-order/format only |
| `799e3935287cbb0ff0f43d7362d97f1b593d72cc` | version bump |
| `8eccc5a968df777b466cc962d3f72888d38a6c94` | version-bump revert |
| `91c1b6b8aa7abf9de13731c688e393541784fa4f` | version-bump revert |
| `a39a23f070e9bb4ce360886e15b9e84c9ed465e4` | version bump |
| `aa63907d99efabc4b6f1318170651197b3418ff7` | version bump |
| `af746ee841416ea57f865f26eb9d33081d39e46a` | version bump |
| `b0fd6a7ee771d22918d0429e319bbe26e4e247fa` | version bump |
| `c3694cd8b3df798f3d6ee34e8ec3ddac1a8cbb2a` | version-bump revert |
| `ce52902fdd654ed3cb7b06c5b59d1fe51cbed266` | import-order/format only |
| `d94a947f19de618c86328b1f460953d2889eaf2f` | format only |
| `e0ab7d62ec16dcff8b24f98c7edbec9f012f7ed6` | version bump |
| `ee15071cb52316708a1a2235958ee7bfdd7738ec` | version bump |
| `ef0c8577ee3da9702e39dd7ee0ba22451831e0d1` | version bump |
| `f25595a70910fb99c4d5dc73a9e5136213a3262c` | format only |
| `f25dfd7a3357daf8fbb0766376ccdaaeb86c8930` | version bump |

## Hash-set proof

Commands run:

```bash
git -C devlog/_gjc_chase/gajae-code rev-list --no-merges --count 3ddf26079..baa4dc76
git -C devlog/_gjc_chase/gajae-code rev-list --no-merges --count 3ddf26079..v0.11.5
git -C devlog/_gjc_chase/gajae-code rev-list --no-merges --count v0.11.5..v0.11.8
git -C devlog/_gjc_chase/gajae-code rev-list --no-merges --count v0.11.8..baa4dc76
rg -o '`[0-9a-f]{40}`' struct_har/chase/10.10[8-9]_*.md struct_har/chase/10.11[0-7]_*.md
# Ruby Set proof: delta - cited - no_card
```

Observed set math:

| set | unique hashes |
|---|---:|
| delta | 529 |
| card-cited | 507 |
| explicit no-card | 22 |
| residual (`delta - cited - no_card`) | **0** |

The reverse check also found no card-cited hash outside the reviewed delta. No overflow occurred; card numbers `10.118`–`10.119` remain unused.
