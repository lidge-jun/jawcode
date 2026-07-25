# 023 — OMP band 3 chase-card coverage

## Frozen range

- Evidence clone (read-only): `devlog/_omp_chase/oh-my-pi`
- Range: `v17.1.0..59619623`
- Included tags: `v17.1.1`, `v17.1.2`, `v17.1.3`
- Non-merge delta: **84**
- Cards written: **7** (`20.121`–`20.127`); no overflow and no RESIDUAL.

## Card allocation

| card | theme | classification | bucket | cited commits |
| --- | --- | --- | --- | ---: |
| `20.121` | native computer use | split | C | 9 |
| `20.122` | TUI/tool lifecycle | adapt | A | 19 |
| `20.123` | native live/audio/attestation | split | C | 9 |
| `20.124` | AI/provider stream integrity | adapt | A | 15 |
| `20.125` | task/rebuild/search/rendering | split | C | 13 |
| `20.126` | account/usage/launch/stats | split | C | 6 |
| `20.127` | shell/native CI | evidence-fill | B | 5 |
| **total cited** |  |  |  | **76** |

## Explicit no-card hashes (8)

| commit | reason |
| --- | --- |
| `914a0d064577440936fd7ca42434fa4f2240a86e` | Changelog-only restoration after the computer merge; no standalone behavior. |
| `e06f9801a55f2cd8434aa699fdffe4900fe55767` | Changelog normalization after merged PRs; release hygiene only. |
| `c36826cbacb66a79ae5fe85655dfa344687b0357` | Version bump to `17.1.1`; generated package/version metadata. |
| `69307261c332a78dc41d5a3e14f5af8edc8a3f51` | OMP runner-image provisioning (`cmake`/`ninja`), not a portable JWC product delta. |
| `c55b28a26d4090f2f80b3ebdc31542972cce5466` | Formatting-only eval display helper cleanup. |
| `7ebf141743713afbe611bec714bb764a86c65cf9` | Version bump to `17.1.2`. |
| `a38cd95d7d8c457a22f1b81c059b5491d78f79a3` | Follow-up `17.1.2` bump affecting a test snapshot only. |
| `0491f2961a54994ac625d3e3bb6bfc8a4ed9fdb6` | Version bump to `17.1.3`. |

## Hash-set proof

Commands:

```bash
git -C devlog/_omp_chase/oh-my-pi rev-list --no-merges --count v17.1.0..59619623
git -C devlog/_omp_chase/oh-my-pi rev-list --no-merges v17.1.0..59619623 | sort -u > /tmp/omp-b3-delta
rg -o '`[0-9a-f]{9,40}`' struct_har/chase/20.12{1,2,3,4,5,6,7}_*.md \
  | sed -E 's/.*`([0-9a-f]+)`.*/\1/' > /tmp/omp-b3-card-prefixes
# Expand each unique card prefix with: git -C devlog/_omp_chase/oh-my-pi rev-parse "$prefix"
# Add the eight full no-card hashes above, sort -u, then compare with comm.
comm -23 /tmp/omp-b3-delta /tmp/omp-b3-covered
comm -13 /tmp/omp-b3-delta /tmp/omp-b3-covered
```

Observed math:

```text
delta unique       = 84
card-cited unique  = 76
no-card unique     = 8
covered unique     = 84
delta - covered    = ∅
covered - delta    = ∅
duplicate overlap  = ∅
RESIDUAL           = ∅
```

The coverage unit is the full commit hash after prefix expansion; table row counts are not used as proof.
