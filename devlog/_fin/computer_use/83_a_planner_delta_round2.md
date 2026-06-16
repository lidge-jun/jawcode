PASS
Findings: none.
Most likely misread: `computer_use` abort/cancellation must be rethrown through the existing abort path; all other backend failures return an `{ ok: false }` envelope.
