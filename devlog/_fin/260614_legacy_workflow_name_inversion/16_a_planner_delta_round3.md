PASS

Findings:
- None. B4a now explicitly mandates `commands/ultragoal.ts` be kept only as a hidden/deprecated diagnostic alias to `jwc goal` during transition, with normal examples/root-help promotion removed and full removal reserved for later cleanup.
- None. B4a now explicitly mandates `commands/ralplan.ts` be kept only as a hidden/deprecated diagnostic alias pointing to `jwc orchestrate p` and `jwc planphase --write`, with normal examples/root-help promotion removed and full removal reserved for later cleanup.

Most likely remaining misread: The retained `ultragoal` and `ralplan` files are not public workflow surfaces; B4a keeps them only as temporary hidden/deprecated diagnostic aliases until compatibility tests are retired.
