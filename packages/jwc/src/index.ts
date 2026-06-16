/**
 * jwc 공개 경계 (public boundary export).
 *
 * - SDK 표면: ./sdk (createAgentSession, discoverSkills, buildSystemPrompt, …)
 * - Phase 3에서 cli-jaw 상주 런타임(JawRuntime: AgentSession 풀, 이벤트 매핑)이
 *   이 패키지에 추가된다 — devlog/_plan/260612_jawcode_fork/03_roadmap_phases.md 참조.
 */
export * from "./sdk";
