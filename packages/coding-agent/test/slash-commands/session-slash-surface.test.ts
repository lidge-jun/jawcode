import { describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { BUILTIN_SLASH_COMMANDS } from "@jawcode-dev/coding-agent/extensibility/slash-commands";
import type { InteractiveModeContext } from "@jawcode-dev/coding-agent/modes/types";
import {
	BUILTIN_SLASH_COMMAND_DEFS,
	executeBuiltinSlashCommand,
} from "@jawcode-dev/coding-agent/slash-commands/builtin-registry";

const repoRoot = path.resolve(import.meta.dir, "..", "..", "..", "..");

function srcPath(...parts: string[]): string {
	return path.join(repoRoot, "packages", "coding-agent", "src", ...parts);
}

function createRuntimeHarness() {
	const setText = vi.fn();
	const handleForkCommand = vi.fn(async (_message?: string) => {
		return;
	});
	const handleResumeByIdCommand = vi.fn(async (_sessionArg: string) => {
		return;
	});
	const showSessionSelector = vi.fn();
	const showUserMessageSelector = vi.fn();

	return {
		setText,
		handleForkCommand,
		handleResumeByIdCommand,
		showSessionSelector,
		showUserMessageSelector,
		runtime: {
			ctx: {
				editor: { setText } as unknown as InteractiveModeContext["editor"],
				handleForkCommand,
				handleResumeByIdCommand,
				showSessionSelector,
				showUserMessageSelector,
			} as unknown as InteractiveModeContext,
			handleBackgroundCommand: () => {},
		},
	};
}

describe("session slash surface (99.07.01)", () => {
	it("/fork with no args forks without a message", async () => {
		const harness = createRuntimeHarness();
		expect(await executeBuiltinSlashCommand("/fork", harness.runtime)).toBe(true);
		expect(harness.handleForkCommand).toHaveBeenCalledWith(undefined);
		expect(harness.setText).toHaveBeenCalledWith("");
	});

	it("/fork <message> forwards the message for post-fork prompting", async () => {
		const harness = createRuntimeHarness();
		expect(await executeBuiltinSlashCommand("/fork ㅎㅇ 잘 되나", harness.runtime)).toBe(true);
		expect(harness.handleForkCommand).toHaveBeenCalledWith("ㅎㅇ 잘 되나");
	});

	it("/resume with no args opens the session selector", async () => {
		const harness = createRuntimeHarness();
		expect(await executeBuiltinSlashCommand("/resume", harness.runtime)).toBe(true);
		expect(harness.showSessionSelector).toHaveBeenCalledTimes(1);
		expect(harness.handleResumeByIdCommand).not.toHaveBeenCalled();
	});

	it("/resume <id> jumps directly by id prefix", async () => {
		const harness = createRuntimeHarness();
		expect(await executeBuiltinSlashCommand("/resume 9ad2d58b", harness.runtime)).toBe(true);
		expect(harness.handleResumeByIdCommand).toHaveBeenCalledWith("9ad2d58b");
		expect(harness.showSessionSelector).not.toHaveBeenCalled();
	});

	it("/sessions and /switch dispatch as aliases of /resume", async () => {
		for (const alias of ["/sessions", "/switch"]) {
			const harness = createRuntimeHarness();
			expect(await executeBuiltinSlashCommand(alias, harness.runtime)).toBe(true);
			expect(harness.showSessionSelector).toHaveBeenCalledTimes(1);
		}
		const harness = createRuntimeHarness();
		expect(await executeBuiltinSlashCommand("/switch 9ad2d58b", harness.runtime)).toBe(true);
		expect(harness.handleResumeByIdCommand).toHaveBeenCalledWith("9ad2d58b");
	});

	it("/branch opens the earlier-user-message selector (semantic split from /fork)", async () => {
		const harness = createRuntimeHarness();
		expect(await executeBuiltinSlashCommand("/branch", harness.runtime)).toBe(true);
		expect(harness.showUserMessageSelector).toHaveBeenCalledTimes(1);
		expect(harness.handleForkCommand).not.toHaveBeenCalled();
	});

	it("exposes aliases as separate autocomplete entries", () => {
		const names = BUILTIN_SLASH_COMMANDS.map(cmd => cmd.name);
		expect(names).toContain("resume");
		expect(names).toContain("sessions");
		expect(names).toContain("switch");
		// Pre-existing alias also becomes discoverable via the same infra.
		expect(names).toContain("bg");

		const sessionsEntry = BUILTIN_SLASH_COMMANDS.find(cmd => cmd.name === "sessions");
		expect(sessionsEntry?.description).toContain("(alias of /resume)");
		// Alias entries inherit the primary command's inline hint surface.
		const resumeEntry = BUILTIN_SLASH_COMMANDS.find(cmd => cmd.name === "resume");
		expect(sessionsEntry?.getInlineHint?.("")).toBe(resumeEntry?.getInlineHint?.("") ?? null);
	});

	it("carries aliases through BUILTIN_SLASH_COMMAND_DEFS", () => {
		const resumeDef = BUILTIN_SLASH_COMMAND_DEFS.find(def => def.name === "resume");
		expect(resumeDef?.aliases).toEqual(["sessions", "switch"]);
	});

	it("fork handler clears queued messages and prints return guidance (source contract)", async () => {
		const agentSession = await Bun.file(srcPath("session", "agent-session.ts")).text();
		const forkBody = agentSession.slice(agentSession.indexOf("async fork(): Promise<boolean>"));
		const forkSlice = forkBody.slice(0, forkBody.indexOf("// ====="));
		for (const cleared of [
			"#steeringMessages = []",
			"#followUpMessages = []",
			"#pendingNextTurnMessages = []",
			"#scheduledHiddenNextTurnGeneration = undefined",
		]) {
			expect(forkSlice).toContain(cleared);
		}

		const controller = await Bun.file(srcPath("modes", "controllers", "command-controller.ts")).text();
		// Full id, not a prefix: UUIDv7 prefixes collide within the same ~65s creation window.
		const originalSessionIdInterpolation = "$" + "{originalSessionId}";
		expect(controller).toContain(`Use /resume ${originalSessionIdInterpolation} to return to the original`);
		expect(controller).toContain(`-r ${originalSessionIdInterpolation}`);
		expect(controller).not.toContain("originalSessionId.slice(");
	});

	it("/interview enters I-stage and returns a prompt even without args", async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-interview-slash-"));
		try {
			const setText = vi.fn();
			const showStatus = vi.fn();
			const showError = vi.fn();
			const refreshPabcdNow = vi.fn();
			const sendPabcdStageContext = vi.fn(async (_options?: { deliverAs?: string }) => {});
			const harness = {
				ctx: {
					editor: { setText },
					session: {
						sessionManager: {
							getSessionId: () => "slash-session",
							getCwd: () => root,
						},
						sendPabcdStageContext,
					},
					sessionManager: {
						getCwd: () => root,
					},
					statusLine: { refreshPabcdNow },
					showStatus,
					showError,
				} as unknown as InteractiveModeContext,
				handleBackgroundCommand: () => {},
			};

			const prompt = await executeBuiltinSlashCommand("/interview", harness);
			expect(prompt).toBe("i");
			expect(sendPabcdStageContext).toHaveBeenCalledWith({ deliverAs: "nextTurn" });
			expect(refreshPabcdNow).toHaveBeenCalledTimes(1);
			expect(setText).toHaveBeenCalledWith("");
			expect(showError).not.toHaveBeenCalled();
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	it("/interview forwards args as the next prompt after entering I-stage", async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-interview-slash-"));
		try {
			const sendPabcdStageContext = vi.fn(async (_options?: { deliverAs?: string }) => {});
			const harness = {
				ctx: {
					editor: { setText: vi.fn() },
					session: {
						sessionManager: {
							getSessionId: () => "slash-session-args",
							getCwd: () => root,
						},
						sendPabcdStageContext,
					},
					sessionManager: {
						getCwd: () => root,
					},
					statusLine: { refreshPabcdNow: vi.fn() },
					showStatus: vi.fn(),
					showError: vi.fn(),
				} as unknown as InteractiveModeContext,
				handleBackgroundCommand: () => {},
			};

			const prompt = await executeBuiltinSlashCommand("/interview resume actor 설계", harness);
			expect(prompt).toBe("resume actor 설계");
			expect(sendPabcdStageContext).toHaveBeenCalledWith({ deliverAs: "nextTurn" });
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});
});
