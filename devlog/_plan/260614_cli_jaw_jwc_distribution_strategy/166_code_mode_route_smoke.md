# 166 — code-mode route smoke

## Goal

Verify the cli-jaw Code mode REST surface registers and responds on safe read-only endpoints without launching a JWC child process or calling a provider.

## Patch

cli-jaw adds:

- `tests/unit/code-routes.test.ts`

The test mounts `registerCodeRoutes()` on a temporary Express app with auth bypass and verifies:

- `GET /api/code/sessions` returns an empty session list.
- `GET /api/code/permissions` returns an empty permission list.
- `GET /api/code/git-info` rejects missing cwd with 400.
- `GET /api/code/git-info?cwd=<absolute non-repo>` returns `{ isRepo: false }`.

It intentionally avoids `POST /api/code/sessions` because that starts the ACP child process path, which belongs to a later runtime/parity slice.

## Verification

Commands run in `/Users/jun/Developer/new/700_projects/cli-jaw`:

```sh
tsx --import ./tests/setup/test-home.ts --experimental-test-module-mocks --test tests/unit/code-routes.test.ts
npm run typecheck
git diff --check -- tests/unit/code-routes.test.ts
```

Observed evidence:

```text
tests 2
pass 2
fail 0
npm run typecheck -> exit 0
```

## Result

Slice 166 proves the route registration and read-only code-mode session surfaces are wired. It does not claim full ACP child-process parity.
