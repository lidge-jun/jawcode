# 167 — legacy-name inventory v2

## Goal

Add an explicit inventory for `gajae`/`gjc` legacy-name occurrences so the cleanup roadmap can distinguish blockers from retained history and compatibility internals.

## Patch

Jawcode adds:

- `scripts/legacy-name-inventory.ts`
- `package.json` script `inventory:legacy-names`

The script scans repository text files, skips binary/build/vendor directories, and buckets hits into:

- `active-public`
- `current-internal`
- `compat-internal`
- `history`
- `reference`

This is an inventory/reporting tool, not a strict gate. The strict active-public gate remains `scripts/check-public-legacy-zero.ts`.

## Verification

Commands run in `/Users/jun/Developer/new/700_projects/jawcode`:

```sh
bun run inventory:legacy-names
bun scripts/check-public-legacy-zero.ts
git diff --check -- package.json scripts/legacy-name-inventory.ts
```

Observed inventory summary:

```json
{
  "active-public": 346,
  "current-internal": 880,
  "compat-internal": 7429,
  "history": 11902,
  "reference": 1068
}
```

Observed strict guard:

```text
Active public legacy identity zero OK
```

## Result

Slice 167 gives later cleanup slices a reproducible classification report instead of relying on raw grep counts. The report intentionally shows many docs/current-internal hits; slice 168 decides which active/current hits to clean versus keep as documented compatibility/history.
