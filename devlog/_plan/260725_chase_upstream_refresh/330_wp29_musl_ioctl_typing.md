# 330 — wp29: the crate could not compile for a release target

Source: named residual in the wp10 `_fin` card for `20.088` — *"`FICLONE` typed as `libc::c_ulong` in
`crates/pi-iso/src/linux_reflink.rs`"*.

| phase | evidence |
|---|---|
| P | libc source + a real musl cross-check |
| A | **pass**, CI step bounded, unrelated failure separated |
| B | `5445e08` |
| C | musl and glibc both check clean; ablation fails on musl |

## Not a style nit

`libc::ioctl` takes `request: Ioctl`, and that alias is **target-dependent**:

| target | `libc::Ioctl` |
|---|---|
| linux-gnu | `c_ulong` |
| linux-uclibc | `c_ulong` |
| **linux-musl** | **`c_int`** |

The constant was hardcoded to `c_ulong`, so `pi-iso` does not compile for musl at all. The same card names
musl as a release target in its `update-cli` asset-selection residual, so this is a build break on a shipping
platform, not a hypothetical.

## Proving it rather than arguing it

A cross-target type bug is exactly the kind that gets "fixed" by inspection and then confidently mis-stated,
especially from a macOS host where nothing here compiles anyway. So I installed
`x86_64-unknown-linux-musl` and checked both directions:

- with `libc::Ioctl` — `cargo check -p pi-iso --target …musl` **passes**;
- ablated back to `c_ulong` — **fails**, `error[E0308]: mismatched types`.

glibc still checks clean, which is what makes the alias the right fix rather than a `cfg` fork.

## Separating someone else's failure from mine

`cargo check --workspace --target …musl` fails on `tree-sitter`. That is a missing `x86_64-linux-musl-gcc`
C toolchain, not this change — confirmed by stashing everything and getting the identical failure.

That is why the new CI step is scoped to `pi-iso` rather than the workspace. Provisioning a C cross-toolchain
in CI to guard a *type-level* property would be a large amount of machinery for the wrong reason, and a
whole-workspace musl job that fails for unrelated toolchain reasons is worse than no job: it trains people to
ignore it.

Swept for the same pattern while I was here — `pi-natives/src/tty.rs` already coerces its ioctl request with
`as _` and is unaffected.
