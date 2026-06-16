# 00 — estimateToolSchemaTokens 정확도 개선

> C1 작업: context-usage.ts 단일 파일 변경, 추정 정확도 3-6x 개선

## 문제

`estimateToolSchemaTokens()`가 `JSON.stringify(tool.parameters)`로 zod 내부 객체를 직렬화합니다.
zod 객체에는 `_zod` 메타데이터, validator 함수 참조 등이 포함되어 실제 API wire schema보다
3-6배 부풀려진 토큰 수를 표시합니다.

실측 비교 (browser 도구):
- `JSON.stringify(zod)`: 10,360 chars → ~2,590 tokens (StatusLine 표시)
- `toolWireSchema()` → `JSON.stringify()`: 1,860 chars → ~465 tokens (실제 API)
- 부풀림: **5.6x**

## 해결

`JSON.stringify(tool.parameters)` → `JSON.stringify(toolWireSchema(tool))` 로 교체.
`toolWireSchema()`는 이미 모든 provider가 사용하는 함수 (캐시됨).

## MODIFY `packages/coding-agent/src/modes/utils/context-usage.ts`

```diff
+import { toolWireSchema } from "@gajae-code/ai/utils/schema";
 
 export function estimateToolSchemaTokens(
-	tools: ReadonlyArray<Pick<Tool, "name" | "description" | "parameters">>,
+	tools: ReadonlyArray<Tool>,
 ): number {
 	const fragments: string[] = [];
 	for (const tool of tools) {
 		fragments.push(tool.name, tool.description);
 		try {
-			fragments.push(JSON.stringify(tool.parameters ?? {}));
+			fragments.push(JSON.stringify(toolWireSchema(tool)));
 		} catch {
-			// Schema may contain functions or cycles; ignore.
+			// Wire schema conversion may fail for exotic schemas; fall back to empty.
 		}
 	}
 	return estimateTextTokensHeuristic(fragments);
 }
```

## 검증

1. OpenAI proxy로 실제 API 호출 → usage.input_tokens 확인 (패치 전)
2. bun check
3. bun test (관련 테스트)
4. 패치 후 StatusLine 표시값과 API usage 비교
