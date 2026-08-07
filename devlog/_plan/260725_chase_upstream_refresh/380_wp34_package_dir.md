# 380 — wp34: a documented setting nothing read, and a walk that could not work

Source: named residual in the wp10 `_fin` card for `20.088` — *"`getPackageDir` compiled-shim probe"*.

| phase | evidence |
|---|---|
| P | reproduced both defects |
| A | **pass**, after rejecting the shallow fix and a non-discriminating test |
| B | `4d821f3` |
| C | gates green; two ablations |

## Two defects, one function

**The override name.** It read `GJC_PACKAGE_DIR` and `PI_PACKAGE_DIR` but not `JWC_PACKAGE_DIR` — the name
`docs/environment-variables.md` tells operators to use. Setting it did nothing, silently.

**The walk.** It climbs from `import.meta.dir` looking for `package.json`. Inside a `bun --compile` binary
that path is in the embedded `$bunfs` filesystem, where no `package.json` exists — so the loop runs to the
filesystem root and falls through, returning the user's **cwd** as though it were the package directory.

## The shallow fix would have missed why it broke

Adding `JWC_PACKAGE_DIR` as a third `process.env` lookup works and is wrong. wp14 established that the
`JWC_*` → legacy mirror runs **inside the env module**, so any raw `process.env` read bypasses it by
construction. Reading through `$env` fixes the class rather than this one instance, and a test asserts
`process.env` no longer appears in that resolver.

Worth noting this is the second time this session that wp14's fix turned out not to reach a call site —
mirroring at load time only helps consumers who go through the mirrored object.

## My compiled-path test could not fail

The first version ran the probe from inside `packages/coding-agent`. So `getProjectDir()` returned the same
directory the walk would have found, and the assertion could not distinguish the two paths at all — it would
have passed with the fix reverted.

Rewritten to run from a temp directory outside any package, where the answers genuinely diverge: uncompiled
finds the repo package that owns `config.ts`, compiled does not. Now the ablation forcing the walk back on
turns it red.

`isCompiledBinary()` was verified rather than assumed to be usable here: it checks `import.meta.url` of its
own module in `packages/utils` plus the build-injected `PI_COMPILED` marker, so calling it from `config.ts`
is sound.
