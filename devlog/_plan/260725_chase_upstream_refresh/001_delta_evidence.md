# 001 — delta evidence: 2026-07-25 chase refresh

Captured: 2026-07-25 (Asia/Seoul), after `git fetch` of both clones.

## GJC (gajae-code)

- Clone: `devlog/_gjc_chase/gajae-code` (remote `upstream` = Yeachan-Heo/gajae-code)
- Previous anchor: `3ddf26079` (upstream/dev, 2026-07-17 11:23 +0900, "v0.11.1+")
- New head: `baa4dc76b585e2ff952e71202dd59b1229d33af3` (upstream/dev, 2026-07-25)
- Ancestry: `git merge-base --is-ancestor 3ddf26079 baa4dc76` → OK
- Delta: **529 non-merge commits**, 1139 files, +184276/−33319
- Hot dirs: packages/coding-agent (844), packages/ai (67), packages/tui (34), packages/agent (18), packages/utils (16), packages/natives (15), python/gjc-sdk (12)
- Version bands (cumulative non-merge count from anchor):
  - v0.11.5 = 290 · v0.11.6 = 299 · v0.11.7 = 386 · v0.11.8 = 463 · v0.11.9 = 498 · v0.11.10 = 519 · head = 529
- Suggested band split: B1 anchor..v0.11.5 (290), B2 v0.11.5..v0.11.8 (173), B3 v0.11.8..head (66)

## OMP (oh-my-pi)

- Clone: `devlog/_omp_chase/oh-my-pi` (remote `origin` = can1357/oh-my-pi, main)
- Previous anchor: `b0d04e517` (2026-07-17 04:15 +0200)
- New head: `59619623e1eeb7c290649eeaf3a269284ce8adef` (2026-07-25)
- Ancestry: `git merge-base --is-ancestor b0d04e517 59619623` → OK
- Delta: **1301 non-merge commits**, 1213 files, +146234/−28270
- Hot dirs: packages/coding-agent (761), packages/ai (161), packages/catalog (42), packages/tui (37), packages/stats (28), packages/agent (22), python/robomp (17)
- Version bands (cumulative non-merge count from anchor):
  - v17.0.6 = 502 · v17.0.7 = 505 · v17.0.8 = 678 · v17.0.9 = 745 · v17.1.0 = 1217 · v17.1.1 = 1250 · v17.1.2 = 1292 · v17.1.3 = 1300 · head = 1301
- Suggested band split: B1 anchor..v17.0.8 (678), B2 v17.0.8..v17.1.0 (539), B3 v17.1.0..head (84)

## Coverage verification method

Card anchors must hash-set-cover the delta: for each band, `git rev-list --no-merges <range>` hashed and set-compared against the union of commit anchors cited in that band's cards; remainder commits must be explicitly listed as no-card (chore/docs/bot) with reason. Row counts overcount; set difference is the only accepted proof (per 2026-07-17 round retrospective).
