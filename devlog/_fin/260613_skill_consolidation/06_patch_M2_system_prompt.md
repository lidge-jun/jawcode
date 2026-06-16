# M2 패치: system-prompt.md 라인별 변경

> sonnet 서브에이전트 생성 (260613)

## 변경 요약

| 라인 | 액션 | 현재 | 변경 |
|---|---|---|---|
| 24 | EDIT | `ralplan consensus refinement` | `` `orchestrate p` consensus refinement `` |
| 27-29 | DELETE | `<skill name="ralplan">` 블록 | 삭제 |
| 31-33 | DELETE | `<skill name="ultragoal">` 블록 | 삭제 |
| 42 | KEEP | `.jwc/plans/ralplan/` 경로 | 변경 없음 (실제 디스크 경로) |
| 53 | REWRITE | `jwc ralplan`, `jwc ultragoal` | `jwc orchestrate p`, `jwc goal` |
| 81 | EDIT | `use ralplan` | `run orchestrate p` |
| 82 | EDIT | `use ultragoal; run ralplan` | `use goal; run orchestrate p` |

변경 없음: L23-26 (jaw-interview), L35-37 (team), L39-51 (orchestrate), L42 (디스크 경로)

## 라인별 상세

### L24: jaw-interview handoff 문구

```diff
- The normal handoff is jaw-interview spec → ralplan consensus refinement → pending approval → separately approved execution.
+ The normal handoff is jaw-interview spec → `orchestrate p` consensus refinement → pending approval → separately approved execution.
```

### L27-29: ralplan skill 블록 삭제

```diff
- <skill name="ralplan" user-entrypoint="/skill:ralplan" cli-runtime="native: jwc ralplan">
- **IPABCD P-stage consensus engine.** Use for consensus planning when requirements are clear enough to plan but architecture, sequencing, or verification needs Planner/Architect/Critic agreement. Plans belong under `.jwc/plans/` and remain pending approval until the user explicitly approves execution.
- </skill>
```

orchestrate native-workflow 블록 (L39-51)이 이미 p-stage를 완전 기술.

### L31-33: ultragoal skill 블록 삭제

```diff
- <skill name="ultragoal" user-entrypoint="/skill:ultragoal" cli-runtime="native: jwc ultragoal">
- **Goal ledger.** Use for durable multi-goal execution ledgers under `.jwc/ultragoal/`, especially when a leader must track goal state, checkpoints, and evidence across a long-running effort.
- </skill>
```

동적 `{{#list skills}}` 블록 (L240-249)이 런타임에 렌더.

### L53: 네이티브 커맨드 목록

```diff
- Agent sessions MUST activate bundled workflow skills via the `/skill:<name>` user-entrypoint unless a skill explicitly requires its native CLI runtime. `jwc jaw-interview`, `jwc ralplan`, `jwc ultragoal`, and `jwc team` are all native commands that read and write `.jwc/state`, `.jwc/plans`, and `.jwc/ultragoal` directly.
+ Agent sessions MUST activate bundled workflow skills via the `/skill:<name>` user-entrypoint unless a skill explicitly requires its native CLI runtime. `jwc jaw-interview` and `jwc team` are native commands that read and write `.jwc/state` and `.jwc/plans` directly. Planning uses `jwc orchestrate p`; goal ledger uses `jwc goal` (or `/skill:goal`).
```

### L80-82: 라우팅 테이블

```diff
  - Vague requirements → use `jaw-interview` before planning or execution.
- - Clear requirements but non-trivial architecture/sequence risk → use `ralplan` and stop at pending approval.
- - Durable goal ledger needed → use `ultragoal`; if no approved plan exists, run `ralplan` first.
+ - Clear requirements but non-trivial architecture/sequence risk → run `orchestrate p` and stop at pending approval.
+ - Durable goal ledger needed → use `goal`; if no approved plan exists, run `orchestrate p` first.
```
