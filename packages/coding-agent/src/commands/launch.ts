/**
 * Root command for the coding agent CLI.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { THINKING_EFFORTS } from "@jawcode-dev/ai";
import { APP_NAME, setProjectDir } from "@jawcode-dev/utils";
import { Args, Command, Flags } from "@jawcode-dev/utils/cli";
import { parseArgs } from "../cli/args";
import { launchDefaultTmuxIfNeeded } from "../jwc-runtime/launch-tmux";
import { prepareLaunchWorktree } from "../jwc-runtime/launch-worktree";
import {
	GJC_COORDINATOR_SESSION_ID_ENV,
	GJC_COORDINATOR_SESSION_STATE_FILE_ENV,
	JWC_COORDINATOR_SESSION_ID_ENV,
	JWC_COORDINATOR_SESSION_STATE_FILE_ENV,
} from "../jwc-runtime/session-state-sidecar";
import { runRootCommand } from "../main";
import { prepareAcpTerminalAuthArgs } from "../modes/acp/terminal-auth";

async function persistCoordinatorLaunchFailure(cwd: string, error: unknown): Promise<void> {
	const stateFile =
		process.env[JWC_COORDINATOR_SESSION_STATE_FILE_ENV]?.trim() ||
		process.env[GJC_COORDINATOR_SESSION_STATE_FILE_ENV]?.trim();
	if (!stateFile) return;
	const message = error instanceof Error ? error.message : String(error);
	let previous: Record<string, unknown> = {};
	try {
		previous = JSON.parse(await Bun.file(stateFile).text()) as Record<string, unknown>;
	} catch {
		previous = {};
	}
	const now = new Date().toISOString();
	const payload = {
		schema_version: 1,
		session_id:
			process.env[JWC_COORDINATOR_SESSION_ID_ENV]?.trim() ||
			process.env[GJC_COORDINATOR_SESSION_ID_ENV]?.trim() ||
			(typeof previous.session_id === "string" ? previous.session_id : "unknown"),
		state: "errored",
		ready_for_input: false,
		current_turn_id: typeof previous.current_turn_id === "string" ? previous.current_turn_id : null,
		last_turn_id: typeof previous.last_turn_id === "string" ? previous.last_turn_id : null,
		updated_at: now,
		source: "agent_session_event",
		live: false,
		reason: message,
		event: "launch_worktree_error",
		cwd,
		final_response: {
			text: message,
			format: "markdown",
			source: "runtime_state",
			artifact_path: null,
			truncated: false,
		},
	};
	try {
		await fs.mkdir(path.dirname(stateFile), { recursive: true });
		await Bun.write(stateFile, `${JSON.stringify(payload, null, 2)}\n`);
	} catch (persistError) {
		console.error(
			`Failed to persist coordinator launch failure: ${persistError instanceof Error ? persistError.message : String(persistError)}`,
		);
	}
}

export default class Index extends Command {
	static description = "Red-claw AI coding assistant";
	static hidden = true;

	static args = {
		messages: Args.string({
			description: "Messages to send (prefix files with @)",
			required: false,
			multiple: true,
		}),
	};

	static flags = {
		model: Flags.string({
			description: 'Model to use (fuzzy match: "opus", "gpt-5.2", or "openai/gpt-5.2")',
		}),
		smol: Flags.string({
			description: "Smol/fast model for lightweight tasks (or JWC_SMOL_MODEL env)",
		}),
		slow: Flags.string({
			description: "Slow/reasoning model for thorough analysis (or JWC_SLOW_MODEL env)",
		}),
		plan: Flags.string({
			description: "Plan model for architectural planning (or JWC_PLAN_MODEL env)",
		}),
		mpreset: Flags.string({
			description: "Model profile preset to activate for this session",
		}),
		default: Flags.boolean({
			description: "Persist --mpreset as the default model profile",
		}),
		provider: Flags.string({
			description: "Provider to use (legacy; prefer --model)",
		}),
		"api-key": Flags.string({
			description: "API key (defaults to env vars)",
		}),
		"system-prompt": Flags.string({
			description: "System prompt (default: coding assistant prompt)",
		}),
		"append-system-prompt": Flags.string({
			description: "Append text or file contents to the system prompt",
		}),
		"allow-home": Flags.boolean({
			description: "Allow starting in ~ without auto-switching to a temp dir",
		}),
		mode: Flags.string({
			description: "Output mode: text (default), json, rpc, acp, rpc-ui, or bridge",
			options: ["text", "json", "rpc", "acp", "rpc-ui", "bridge"],
		}),
		print: Flags.boolean({
			char: "p",
			description: "Non-interactive mode: process prompt and exit",
		}),
		continue: Flags.boolean({
			char: "c",
			description: "Continue previous session",
		}),
		resume: Flags.string({
			char: "r",
			description: "Resume a session (by ID prefix, path, or picker if omitted)",
		}),
		"session-dir": Flags.string({
			description: "Directory for session storage and lookup",
		}),
		"no-session": Flags.boolean({
			description: "Don't save session (ephemeral)",
		}),
		models: Flags.string({
			description: "Comma-separated model patterns for Ctrl+P cycling",
		}),
		"no-tools": Flags.boolean({
			description: "Disable all built-in tools",
		}),
		"no-lsp": Flags.boolean({
			description: "Disable LSP tools, formatting, and diagnostics",
		}),
		"no-pty": Flags.boolean({
			description: "Disable PTY-based interactive bash execution",
		}),
		tmux: Flags.boolean({
			description: "Launch interactive startup inside tmux",
		}),
		tools: Flags.string({
			description: "Comma-separated list of tools to enable (default: all)",
		}),
		thinking: Flags.string({
			description: `Set thinking level: ${THINKING_EFFORTS.join(", ")}`,
			options: [...THINKING_EFFORTS],
		}),
		hook: Flags.string({
			description: "Load a hook/extension file (can be used multiple times)",
			multiple: true,
		}),
		extension: Flags.string({
			char: "e",
			description: "Load an extension file (can be used multiple times)",
			multiple: true,
		}),
		"no-extensions": Flags.boolean({
			description: "Disable extension discovery (explicit -e paths still work)",
		}),
		"no-skills": Flags.boolean({
			description: "Disable skills discovery and loading",
		}),
		skills: Flags.string({
			description: "Comma-separated glob patterns to filter skills (e.g., git-*,docker)",
		}),
		"no-rules": Flags.boolean({
			description: "Disable rules discovery and loading",
		}),
		export: Flags.string({
			description: "Export session file to HTML and exit",
		}),
		"list-models": Flags.string({
			description: "List available models (with optional fuzzy search)",
		}),
		"no-title": Flags.boolean({
			description: "Disable title auto-generation",
		}),
		verbose: Flags.boolean({
			description: "Render every tool/thinking block permanently expanded (verbose render mode, this session only)",
		}),
	};

	static examples = [
		`# Interactive mode\n  ${APP_NAME}`,
		`# Interactive mode with initial prompt\n  ${APP_NAME} "List all .ts files in src/"`,
		`# Include files in initial message\n  ${APP_NAME} @prompt.md @image.png "What color is the sky?"`,
		`# Non-interactive mode (process and exit)\n  ${APP_NAME} -p "List all .ts files in src/"`,
		`# Continue previous session\n  ${APP_NAME} --continue "What did we discuss?"`,
		`# Launch in a sibling git worktree\n  ${APP_NAME} --worktree`,
		`# Use different model (fuzzy matching)\n  ${APP_NAME} --model opus "Help me refactor this code"`,
		`# Limit model cycling to specific models\n  ${APP_NAME} --models claude-sonnet,claude-haiku,gpt-4o`,
		`# Activate a model profile for this session\n  ${APP_NAME} --mpreset codex-standard`,
		`# Persist a model profile as the default\n  ${APP_NAME} --mpreset opencode-go-pro --default`,
		`# Export a session file to HTML\n  ${APP_NAME} --export ~/.jwc/agent/sessions/--path--/session.jsonl`,
	];

	static strict = false;

	async run(): Promise<void> {
		const { args } = prepareAcpTerminalAuthArgs(this.argv);
		const parsed = parseArgs([...args]);
		if (parsed.help || parsed.version) {
			await runRootCommand(parsed, args);
			return;
		}

		let launch: ReturnType<typeof prepareLaunchWorktree>;
		try {
			launch = prepareLaunchWorktree(process.cwd(), args);
		} catch (error) {
			await persistCoordinatorLaunchFailure(process.cwd(), error);
			throw error;
		}
		if (launch.worktree.enabled) {
			process.chdir(launch.cwd);
			setProjectDir(launch.cwd);
		}
		const launchParsed = parseArgs(launch.args);
		if (
			launchDefaultTmuxIfNeeded({
				parsed: launchParsed,
				rawArgs: launch.args,
				cwd: launch.cwd,
				worktreeBranch: launch.worktree.enabled && !launch.worktree.detached ? launch.worktree.branchName : null,
				project: launch.worktree.enabled ? launch.worktree.repoRoot : launch.cwd,
			})
		)
			return;
		await runRootCommand(launchParsed, launch.args);
	}
}
