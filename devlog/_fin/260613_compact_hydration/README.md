# 260613 — compact 후 이전 대화내역 hydration 버그

> 상태: 🔧 수정 진행 중
> 증상: TUI에서 compact 실행 후 이전 대화내역이 다시 표시됨 (hydrate)
> 심각도: UX 버그 (기능 정상, 표시 오류)

## 버그 분석

### 재현 시나리오

1. 긴 대화 진행 (messages A~G)
2. compact 발생 → A~D 요약, E~G 유지 ("kept messages")
3. 계속 대화 (H~J)
4. 두 번째 compact → E~H 요약, I~J 유지
5. **문제**: chat 화면에 compaction1 이전 메시지까지 표시

### 코드 흐름

```
compact() 완료
  → appendCompaction(firstKeptEntryId)
  → rebuildChatFromMessages()
    → chatContainer.clear()
    → buildDisplaySessionContext()
      → buildSessionContext(entries, leafId)  ← 핵심
        → path 구축 (leaf → root 역순회)
        → compaction = 마지막 compaction 엔트리
        → compactionIdx = path에서 compaction 위치
        → loop i=0..compactionIdx: firstKeptEntryId 검색 → 이후 전부 emit
    → renderSessionContext(context)
      → compactionSummary는 하단으로 defer
      → kept messages + post-compaction messages 렌더
```

### 근본 원인

`buildSessionContext` (`session-manager.ts:694`)의 kept-messages 루프:

```typescript
for (let i = 0; i < compactionIdx; i++) {
    if (entry.id === compaction.firstKeptEntryId) {
        foundFirstKept = true;
    }
    if (foundFirstKept) appendMessage(entry);
}
```

이 루프는 `path[0]`부터 스캔 → 이전 compaction 경계를 무시.

`prepareCompaction`의 `findCutPoint`는 `boundaryStart = prevCompactionIndex + 1`로 정확하게 제한하지만, `buildSessionContext`는 이 보장을 검증하지 않음.

만약 `firstKeptEntryId`가 이전 compaction 이전의 entry ID와 일치하면 (ID 충돌, 마이그레이션 잔해, 또는 `findCutPoint` edge case), 이전 compaction의 모든 kept messages까지 hydrate됨.

### 수정

`buildSessionContext`의 kept-messages 루프에 **이전 compaction 경계 clamp** 추가:

```typescript
// Find the previous compaction index to clamp the search range
let prevCompactionIdx = -1;
for (let i = compactionIdx - 1; i >= 0; i--) {
    if (path[i].type === "compaction") {
        prevCompactionIdx = i;
        break;
    }
}
const searchStart = prevCompactionIdx + 1;

let foundFirstKept = false;
for (let i = searchStart; i < compactionIdx; i++) {
    // ...
}
```

이렇게 하면 `firstKeptEntryId`가 아무리 잘못되어도 이전 compaction 경계 이후만 검색/렌더.

### 영향 파일

| 파일 | 변경 |
|---|---|
| `packages/coding-agent/src/session/session-manager.ts` | `buildSessionContext` kept-messages 루프 clamp |

### 연관 커밋

| 커밋 | 내용 |
|---|---|
| `3f1fb069` | `findCutPoint` fallback fix + token cache (관련) |
| `a9590f6d` | pre-prompt compaction 추가 (트리거 확장) |
| `5f3280bb` | pre-prompt dedup (트리거 범위 확장) |
