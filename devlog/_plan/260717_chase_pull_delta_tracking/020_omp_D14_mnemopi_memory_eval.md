# 020_omp_D14_mnemopi_memory_eval

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D14 — mnemopi memory and isolated eval runtimes
> Sol priority: P3
> Model-related: no
> Card target: 20.067_mnemopi_memory_eval
> Worker: OW9

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `44b73b7de` | recover direct mnemopi runtime load failures | memory embedding runtime |
| 2 | `59657c0db` | select trim candidates transactionally | memory beam store |
| 3 | `d866eb858` | protect working memory and cascade linked artifacts | memory beam store |
| 4 | `2997037ff` | pin the Windows ORT DLL path | memory embedding runtime |
| 5 | `f26fffb8e` | isolate memory root resolution | memory internal URL protocol |
| 6 | `5d6fcff2f` | delegate Python URI reads to the host resolver | Python eval prelude |
| 7 | `eef79705a` | pass JavaScript URI selectors separately | JavaScript eval prelude |
| 8 | `2bfdf0ab0` | pass URI selectors separately in Python eval | Python eval prelude |
| 9 | `a83f461b3` | lazy-load the JS eval process entry | CLI/eval startup |
| 10 | `ffa879ba2` | preserve process cwd while other cells are live | JS eval worker core |
| 11 | `640d7c83b` | propagate IPC clone errors to eval cells | CLI; JS eval worker |
| 12 | `95620ccd6` | preserve the async JS fallback ladder | JS eval context manager |
| 13 | `55d9fcfd1` | fall back to a Bun worker on spawn failure | JS eval context manager |
| 14 | `1a527d9a2` | mirror session cwd in the JS subprocess | JS eval process/worker |
| 15 | `9c9da2387` | harden the JS eval subprocess | JS eval process/context |
| 16 | `c40ccdc68` | isolate eval runtimes from the terminal | JS/Python/Ruby/Julia eval runtime |
| 17 | `bfdca36f4` | make the eval isolation probe portable | eval regression tests |

## 주제 분석

이 클러스터는 장기 memory 저장소와 임의 코드 eval을 같은 “격리된 runtime” 관점에서 다룬다. mnemopi는 Windows에서 ORT DLL을 확정 경로로 로드하고 direct load 실패를 복구한다. trim은 transaction 안에서 후보를 선택하며 durable working memory와 연결 artifact를 연쇄 삭제에서 보호한다.

eval은 terminal process와 생명주기·cwd·IPC 오류를 분리한다. subprocess 시작이 실패하면 async JS fallback ladder와 Bun worker를 유지하고, 여러 cell이 살아 있을 때 한 cell의 cwd 변경이 다른 runtime을 흔들지 않게 한다. Python과 JavaScript URI selector는 host resolver에 구조적으로 전달해 selector 문자열이 경로에 섞이지 않도록 한다.

## Worktree 대조

JWC에는 `packages/mnemopi/`가 없어 ORT와 beam-store 패치는 직접 적용할 owner가 없다. memory 쪽 비교 지점은 `packages/coding-agent/src/internal-urls/memory-protocol.ts`와 agent compaction/memory 경계뿐이다. 반면 `packages/coding-agent/src/eval/`은 존재하고 JS worker/process, Python runtime, host URL 해석을 갖춘다. eval isolation·cwd·IPC·URI selector 불변식은 의미 비교가 가능하지만, mnemopi 항목은 JWC memory backend가 확정되기 전까지 reference로 남겨야 한다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `167860761` | fix(eval): preserve column truncation metadata | memory/eval/compaction |
| 2 | `221196704` | fix(coding-agent): cleared autolearn empty-stop override | memory/eval/compaction |
| 3 | `280d4b039` | fix(coding-agent): persist pruned autolearn captures | memory/eval/compaction |
| 4 | `4903a1351` | feat(session): implemented automated recovery and status reporting | memory/eval/compaction |
| 5 | `531aeff15` | fix(session): fall back to LLM compaction on manual /compact for text-only models | memory/eval/compaction |
| 6 | `5c2bae47a` | feat(mode): enabled conditional transcript compaction logic | memory/eval/compaction |
| 7 | `711fa4312` | feat(snapcompact): switched to compact scope markers for archived transcripts | memory/eval/compaction |
| 8 | `7a2b027e4` | fix(eval): keep completion aborts interruptible | memory/eval/compaction |
| 9 | `8e6d26b1e` | fix(eval): honored unlimited cell timeouts | memory/eval/compaction |
| 10 | `a86c1ec46` | fix(eval): shield agent bridge aborts | memory/eval/compaction |
| 11 | `b6f83021c` | fix(coding-agent): ensured top-level declarations persist in async cells | memory/eval/compaction |
| 12 | `bf5eb3769` | feat(coding-agent): rebased pending context snapshot after compaction | memory/eval/compaction |
| 13 | `c36f64d4f` | fix(coding-agent): pruned noop autolearn captures | memory/eval/compaction |
| 14 | `c9032e57b` | fix(session): keep explicit /compact snapcompact failing on text-only models | memory/eval/compaction |
| 15 | `e2afc87a4` | fix(coding-agent): accepted autolearn empty stops | memory/eval/compaction |
