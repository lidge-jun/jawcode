# 180 — wp14: the docs described a runtime that did not exist

Anchor: GJC `dd304faa4` *"honor GJC_PY and GJC_PYTHON_* env overrides"*. Upstream's own commit message names
the shape exactly: *"a silent docs/runtime contract break."* JWC had the same break, wider.

| phase | evidence |
|---|---|
| P | live probe below |
| A | **pass** with one hazard folded in |
| B | `2034ccd` |
| C | gates green; two independent ablations |

## The probe

Setting the documented variables and reading what the runtime actually sees:

```
JWC_PY=0                    → $env.PI_PY === undefined,  $flag("PI_PY") === false
JWC_PYTHON_SKIP_CHECK=1     → $flag("PI_PYTHON_SKIP_CHECK") === false
```

`packages/utils/src/env.ts` mirrored `JWC_*` onto `GJC_*` only. The read sites use neither:
`tools/index.ts` reads `$env.PI_PY`, `eval/py/kernel.ts` reads `$flag("PI_PYTHON_SKIP_CHECK")`. **101
distinct `PI_*` names** exist across the packages, so this was never python-specific.

The most damning evidence was my own: the sixel test I wrote in wp12 sets `PI_FORCE_IMAGE_PROTOCOL`,
because the documented `JWC_` spelling does not work. I worked around the bug instead of noticing it.

## The hazard the audit caught

A blanket `JWC_X → PI_X` mirror is not safe. `PI_COMPILED` is injected by `bun build --define` and is the
fast path in `isCompiledBinary()`, which selects the compiled worker-spawn branch. Mirroring it would let a
stray `JWC_COMPILED` make a normal dev run believe it is a compiled binary and resolve workers from paths
that do not exist. It is excluded, and the exclusion carries its own ablation: removing only that exclusion
turns exactly the marker test red and nothing else.

Preserved behavior, each pinned by a test: `JWC_ISOLATE_LEGACY_ENV=1` still suppresses all mirroring (it
exists for machines running both jwc and upstream gjc), an explicitly set legacy value still wins over the
mirror, and the pre-existing `GJC_` mirror is untouched.

## A wp13 regression I shipped

`check:ts` had been failing since wp13 and I did not see it, because I read the tail of the output and the
error was in the middle. `Command` takes `(argv, config)`; my new tests passed only `argv`. Seven type
errors were on `main`. Fixed here, and the lesson is to grep the check output for errors rather than tail it.

## A trap worth recording

My first end-to-end probe wrote its script into a temp directory. From an unrelated cwd, Bun resolves
`@jawcode-dev/utils` out of the **install cache** — a published build — so the probe measured a different
module and reported the fix as not working. Probe scripts that import workspace packages have to live inside
the repo.
