import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { AgentTool, AgentToolResult } from "@jawcode-dev/agent-core";
import * as z from "zod/v4";
import {
	getNotificationConfig,
	isNotificationEnabled,
	type RenderTelegramMediaResult,
	renderAndSendTelegramMedia,
	resolveWorkspaceFileForNotification,
	type WorkspaceFileRejectionReason,
} from "../notifications";
import type { ToolSession } from ".";

const telegramSendSchema = z.object({
	path: z
		.string()
		.describe(
			"Path to a regular file inside the current workspace to send to the connected Telegram chat. " +
				"Absolute, relative-escape, and symlink paths that resolve outside the workspace are rejected.",
		),
	caption: z.string().optional().describe("Optional caption shown with the file. Never include secrets."),
});

type TelegramSendParams = z.infer<typeof telegramSendSchema>;

export interface TelegramSendToolDetails {
	sent: boolean;
	method?: "sendPhoto" | "sendDocument";
	fileName?: string;
	relativePath?: string;
	sizeBytes?: number;
	rejected?: string;
}

/** Dependency seam so tests can inject a fake fetch without a live bot token. */
export interface TelegramSendToolDeps {
	fetchImpl?: typeof fetch;
}

/** Map a workspace-confinement rejection to a clear, non-egress error message. */
function confinementErrorText(reason: WorkspaceFileRejectionReason): string {
	switch (reason) {
		case "missing_path":
			return "No file path was provided.";
		case "workspace_not_directory":
			return "The workspace root could not be resolved to a directory.";
		case "file_not_found":
			return "No file exists at that path inside the workspace.";
		case "outside_workspace":
			return "Refused: the path resolves outside the workspace (absolute, relative escape, or symlink).";
		case "not_regular_file":
			return "Refused: the path is not a regular file (directories and special files are not allowed).";
		default:
			return "Refused: the file could not be validated for sending.";
	}
}

/** Map an outbound-media result to a tool result. The bot token never appears here. */
function toToolResult(
	result: RenderTelegramMediaResult,
	fileName: string,
	relativePath: string,
	sizeBytes: number,
): AgentToolResult<TelegramSendToolDetails> {
	if (result.ok) {
		return {
			content: [
				{
					type: "text",
					text: `Sent "${relativePath}" (${sizeBytes} bytes) to the connected Telegram chat via ${result.method}.`,
				},
			],
			details: { sent: true, method: result.method, fileName, relativePath, sizeBytes },
		};
	}
	if (result.rejected !== undefined) {
		const why = result.rejected === "too_large" ? "the file exceeds the Telegram size limit" : "the file is empty";
		return {
			content: [{ type: "text", text: `Not sent: ${why}. No data was transmitted.` }],
			details: { sent: false, fileName, relativePath, sizeBytes, rejected: result.rejected },
			isError: true,
		};
	}
	// Network/API failure: `reason` is already token-sanitized by telegram-api.
	return {
		content: [{ type: "text", text: `Telegram send failed: ${result.reason}` }],
		details: { sent: false, fileName, relativePath, sizeBytes, rejected: "send_failed" },
		isError: true,
	};
}

/**
 * Model-visible tool to send a workspace-confined file to the session's connected
 * Telegram chat (chase 10.034, done-gate 2).
 *
 * Discoverability gate: the tool only exists when the session has connected Telegram
 * notifications — i.e. a loopback notification transport is active AND notifications are
 * enabled+configured (so a bot token and chat id exist). Otherwise {@link createIf}
 * returns `null` and the model never sees the tool.
 *
 * Safety: the requested path is resolved through `resolveWorkspaceFileForNotification`
 * (realpath + workspace containment + regular-file check) before any read, and
 * `renderAndSendTelegramMedia` enforces the size/MIME policy before any network egress.
 * The bot token is read from config, passed only to the sender, and never echoed into
 * tool input, output, or error text.
 */
export class TelegramSendTool implements AgentTool<typeof telegramSendSchema, TelegramSendToolDetails> {
	readonly name = "telegram_send";
	readonly label = "Telegram Send";
	readonly summary = "Send a workspace file to the connected Telegram chat";
	readonly loadMode = "discoverable";
	readonly parameters = telegramSendSchema;
	readonly strict = true;
	readonly description =
		"Send a regular file from the current workspace to the connected Telegram chat as a photo " +
		"(in-policy images) or document. Only available when Telegram notifications are connected. " +
		"Paths that resolve outside the workspace, directories, missing files, empty files, and " +
		"oversize files are rejected without transmitting any data.";

	readonly #session: ToolSession;
	readonly #fetchImpl?: typeof fetch;

	constructor(session: ToolSession, deps?: TelegramSendToolDeps) {
		this.#session = session;
		this.#fetchImpl = deps?.fetchImpl;
	}

	/** Connection gate: present only with an active notification transport + configured Telegram. */
	static createIf(session: ToolSession, deps?: TelegramSendToolDeps): TelegramSendTool | null {
		if (session.getNotificationServer?.() === undefined) return null;
		const config = getNotificationConfig(session.settings);
		if (!isNotificationEnabled(config) || !config.botToken || !config.chatId) return null;
		return new TelegramSendTool(session, deps);
	}

	async execute(_toolCallId: string, params: TelegramSendParams): Promise<AgentToolResult<TelegramSendToolDetails>> {
		const config = getNotificationConfig(this.#session.settings);
		if (!isNotificationEnabled(config) || !config.botToken || !config.chatId) {
			return {
				content: [{ type: "text", text: "Telegram notifications are not connected; cannot send." }],
				details: { sent: false, rejected: "not_connected" },
				isError: true,
			};
		}

		const decision = await resolveWorkspaceFileForNotification(this.#session.cwd, params.path);
		if (!decision.ok) {
			return {
				content: [{ type: "text", text: confinementErrorText(decision.reason) }],
				details: { sent: false, rejected: decision.reason },
				isError: true,
			};
		}

		let data: Uint8Array;
		try {
			data = await readFile(decision.realPath);
		} catch (error) {
			return {
				content: [{ type: "text", text: `Could not read the file: ${(error as Error).message}` }],
				details: { sent: false, relativePath: decision.relativePath, rejected: "read_failed" },
				isError: true,
			};
		}

		const fileName = basename(decision.realPath);
		const result = await renderAndSendTelegramMedia({
			token: config.botToken,
			chatId: config.chatId,
			data,
			fileName,
			caption: params.caption,
			fetchImpl: this.#fetchImpl,
		});
		return toToolResult(result, fileName, decision.relativePath, decision.sizeBytes);
	}
}
