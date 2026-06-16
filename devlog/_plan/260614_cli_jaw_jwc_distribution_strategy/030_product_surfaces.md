# 030 — product surfaces

## Surface A: standalone JWC

Purpose: developer can install/run JWC without cli-jaw.

Minimum contract:

- `npm install -g jawcode`
- `jwc --version`
- `jwc --help`
- TUI launch
- workflow definitions from source-bundled JWC defaults
- safe postinstall/onboarding, including managed Bun provisioning
- package tarball does not depend on unpublished workspace packages

## Surface B: cli-jaw embedded JWC

Purpose: cli-jaw can use JWC as an internal runtime without requiring `jwc` to be installed globally.

Minimum contract:

- cli-jaw imports a stable JWC runtime artifact/API.
- import specifier is `jawcode/sdk` after package publication.
- session creation does not spawn a global `jwc` command in the primary path.
- cli-jaw channels remain owners of user-facing persistence and transport.
- rollback can re-enable legacy vendor CLI spawn.

## Surface C: jawcode dev mode

Purpose: local development and upstream sync remain possible.

Minimum contract:

- Bun workspace continues to work for jawcode development.
- internal `@gajae-code/*` package names may remain only as non-public build implementation while upstream sync is still active.
- repo-local smoke/tests prove both standalone and embedding targets.

## Product priority

1. Embedded cli-jaw path must be install-independent.
2. Standalone JWC must be independently releasable.
3. Broad internal namespace cleanup follows after the two runtime surfaces are stable.
