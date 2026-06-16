# 070_memory — 02 logic changes (jwc_patched)

> jwc_patched: fork **실제 로직**. git `upstream/main..HEAD` + [structure/40_fork-delta.md](../../../structure/40_fork-delta.md).
> worktree @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5`.

## jwc 현재

- stage1→phase2; `memory_summary.md` 1파일 주입; **FTS 매턴 주입 없음** (cli-jaw 대비).
- **99.01 ✅**: `jwc memory search|read|save|context`, `jwc chat search`; `local-query.ts`·`memory-fts.ts` — [session_storage.md](../../../structure/22_session_storage.md).

## 정본

- 횡단: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md) §070
- 파일 단위: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 앵커 경로: [02_code_facts.md](./02_code_facts.md)