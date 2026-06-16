export const COORDINATOR_MCP_PROTOCOL_VERSION = "2024-11-05";
export const COORDINATOR_MCP_SERVER_NAME = "jwc-coordinator-mcp";

export const COORDINATOR_MCP_TOOL_NAMES = [
	"jwc_coordinator_list_sessions",
	"jwc_coordinator_read_status",
	"jwc_coordinator_read_tail",
	"jwc_coordinator_list_questions",
	"jwc_coordinator_list_artifacts",
	"jwc_coordinator_read_artifact",
	"jwc_coordinator_read_coordination_status",
	"jwc_coordinator_start_session",
	"jwc_coordinator_send_prompt",
	"jwc_coordinator_submit_question_answer",
	"jwc_coordinator_read_turn",
	"jwc_coordinator_await_turn",
	"jwc_coordinator_report_status",
] as const;

export type CoordinatorToolName = (typeof COORDINATOR_MCP_TOOL_NAMES)[number];
