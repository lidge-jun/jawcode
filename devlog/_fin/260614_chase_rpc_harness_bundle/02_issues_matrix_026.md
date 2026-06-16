# 02 — issues 01–13 → jwc (10.026)

> upstream: `devlog/_upstream_gjc/issues/`  
> Python: **`python/jwc-rpc`** (`jwc_rpc`)

| # | topic | TS | Python | Phase 1 (P plan) |
|---|--------|-----|--------|------------------|
| 01 | dispatch `id` | verify B | — | **fixed** (C: redteam + get-state) |
| 02 | enum validation | defer | — | defer |
| 03 | negotiate scopes | defer | — | defer |
| 04 | control vs tool budget | defer | — | defer |
| 05 | mandatory floor | defer | — | defer |
| 06 | `contextUsage` | server ok | client parse | **partial** |
| 07 | handoff/login APIs | defer | defer | defer |
| 08 | real-binary tests | — | defer | defer |
| 09 | detached session | **fixed** (`--listen`) | **fixed** (`connect_unix`) | **Phase 2 fixed** |
| 10 | session registry | **fixed** (C) | **fixed** (C) | **fixed** |
| 11 | stale docs | chase/devlog | README | **fixed** (D) |
| 12 | emit title env | **fixed** (C) | — | **fixed** |
| 13 | stdin HOL | **fixed** (C) | — | **fixed** |
| — | 008 shutdown/EOF/parse | **fixed** (C) | — | **fixed** (redteam 4/4) |