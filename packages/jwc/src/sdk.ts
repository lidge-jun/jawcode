/**
 * jwc/sdk — cli-jaw 임베딩의 단일 진입점.
 *
 * cli-jaw(또는 다른 호스트)는 업스트림 @jawcode-dev/* 내부 경로를 직접 import하지 않고
 * 반드시 이 재수출 계층만 본다. 업스트림 리베이스로 내부 구조가 바뀌면
 * 이 파일에서만 흡수한다 (structure/conventions.md §1 리베이스 친화 규칙).
 */
export * from "@jawcode-dev/coding-agent/sdk";
