/**
 * Generate session titles using a smol, fast model.
 */
import * as path from "node:path";

import { type Api, type AssistantMessage, completeSimple, type Model, type Tool } from "@jawcode-dev/ai";
import { logger, prompt } from "@jawcode-dev/utils";
import type { ModelRegistry } from "../config/model-registry";
import { resolveRoleSelection } from "../config/model-resolver";
import type { Settings } from "../config/settings";
import titleSystemPrompt from "../prompts/system/title-system.md" with { type: "text" };

const TITLE_SYSTEM_PROMPT = prompt.render(titleSystemPrompt);

const DEFAULT_TERMINAL_TITLE = "🦈";
const TERMINAL_TITLE_CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

const MAX_INPUT_CHARS = 2000;
const TITLE_MAX_TOKENS = 30;
const REASONING_SAFE_MAX_TOKENS = 1024;
const SET_TITLE_TOOL_NAME = "set_title";

// Some models (notably cursor/composer-*) ignore the forced set_title tool call
// and instead emit a long free-text narrative. Without the tool call we fall back
// to the plain text, so cap its length: a real 3-6 word title never exceeds these.
// Beyond the cap we treat the response as a non-title hallucination and reject it.
const MAX_TITLE_CHARS = 80;
const MAX_TITLE_WORDS = 12;

const setTitleTool: Tool = {
	name: SET_TITLE_TOOL_NAME,
	description: "Set the generated session title.",
	parameters: {
		type: "object",
		properties: {
			title: {
				type: "string",
				description: "A concise 3-6 word title for the session.",
			},
		},
		required: ["title"],
		additionalProperties: false,
	},
};

function getTitleModel(registry: ModelRegistry, settings: Settings, currentModel?: Model<Api>): Model<Api> | undefined {
	const availableModels = registry.getAvailable();
	if (availableModels.length === 0) return undefined;

	const titleModel = resolveRoleSelection(["default"], settings, availableModels, registry)?.model;
	if (titleModel) return titleModel;

	if (currentModel) return currentModel;

	return undefined;
}

/**
 * Generate a title for a session based on the first user message.
 *
 * @param firstMessage The first user message
 * @param registry Model registry
 * @param settings Settings used to resolve the smol role
 * @param sessionId Optional session id for sticky API key selection
 * @param currentModel Current model (used to derive title model)
 * @param metadataResolver Optional resolver evaluated after credential selection
 *   to produce request metadata (e.g. user_id for session attribution). Using a
 *   resolver instead of a pre-evaluated value ensures the metadata's account_uuid
 *   reflects the credential actually selected for this request.
 * @param signal Session-lifecycle cancellation for background title generation
 */
export async function generateSessionTitle(
	firstMessage: string,
	registry: ModelRegistry,
	settings: Settings,
	sessionId?: string,
	currentModel?: Model<Api>,
	metadataResolver?: (provider: string) => Record<string, unknown> | undefined,
	signal?: AbortSignal,
): Promise<string | null> {
	const model = getTitleModel(registry, settings, currentModel);
	if (!model) {
		logger.debug("title-generator: no title model found");
		return null;
	}

	// Truncate message if too long
	const truncatedMessage =
		firstMessage.length > MAX_INPUT_CHARS ? `${firstMessage.slice(0, MAX_INPUT_CHARS)}…` : firstMessage;
	const userMessage = `<user-message>
${truncatedMessage}
</user-message>`;

	const apiKey = await registry.getApiKey(model, sessionId);
	if (!apiKey) {
		logger.debug("title-generator: no API key for smol model", {
			provider: model.provider,
			id: model.id,
		});
		return null;
	}
	// Resolve metadata after getApiKey so the session-sticky credential for this
	// request is already recorded; metadataResolver can then return the correct
	// account_uuid rather than the snapshot-at-call-site value.
	const metadata = metadataResolver?.(model.provider);

	// Title generation is a 3-6 word task, but some reasoning backends ignore
	// disableReasoning. Keep the normal cheap budget for non-reasoning models
	// while reserving enough output room for reasoning models to still emit
	// the forced tool call after any unavoidable thinking tokens.
	const maxTokens = model.reasoning ? Math.max(TITLE_MAX_TOKENS, REASONING_SAFE_MAX_TOKENS) : TITLE_MAX_TOKENS;
	const request = {
		model: `${model.provider}/${model.id}`,
		systemPrompt: TITLE_SYSTEM_PROMPT,
		userMessage,
		maxTokens,
	};
	logger.debug("title-generator: request", request);

	try {
		const response = await completeSimple(
			model,
			{
				systemPrompt: [request.systemPrompt],
				messages: [{ role: "user", content: request.userMessage, timestamp: Date.now() }],
				tools: [setTitleTool],
			},
			{
				apiKey,
				maxTokens: request.maxTokens,
				disableReasoning: true,
				toolChoice: { type: "tool", name: SET_TITLE_TOOL_NAME },
				metadata,
				signal,
			},
		);

		if (response.stopReason === "error") {
			logger.debug("title-generator: response error", {
				model: request.model,
				stopReason: response.stopReason,
				errorMessage: response.errorMessage,
			});
			return null;
		}

		const title = extractGeneratedTitle(response.content);

		logger.debug("title-generator: response", {
			model: request.model,
			title,
			usage: response.usage,
			stopReason: response.stopReason,
		});

		if (!title) {
			return null;
		}

		const cleaned = title.replace(/^["']|["']$/g, "").replace(/[.!?]$/, "");
		return reconcileTitleCasing(cleaned, firstMessage);
	} catch (err) {
		logger.debug("title-generator: error", {
			model: request.model,
			error: err instanceof Error ? err.message : String(err),
		});
		return null;
	}
}

const TITLE_WORD = /[\p{L}\p{N}]+/gu;

/**
 * Reconcile a generated title's casing against the user's own message.
 *
 * The title prompt asks for sentence case, but small title models still mangle
 * casing two ways: they sprout stray interior capitals on ordinary words
 * (`daemon` -> `dAemon`) and they flatten proper nouns the user cares about
 * (`TinyVMM` -> `tinyvmm`). The user's message is the source of truth, so per
 * title token:
 *  1. typed verbatim in the message -> keep it (the user established the casing);
 *  2. else the message has the same word with *distinctive* casing
 *     (`TinyVMM`, `iOS`, `API`) -> adopt the user's casing (restoration);
 *  3. else it's a camelCase artifact (lowercase word + stray interior capital,
 *     `dAemon`) the user never wrote -> lowercase it;
 *  4. else leave it -- preserves model-cased proper nouns like `GitHub`, `OAuth`.
 *
 * Restoration is limited to distinctively cased source tokens so a sentence that
 * merely *starts* with `For` can't force a mid-title `for` to `For`.
 */
export function reconcileTitleCasing(title: string, sourceText: string): string {
	const verbatim = new Set<string>();
	const distinctive = new Map<string, string>();
	for (const [token] of sourceText.matchAll(TITLE_WORD)) {
		verbatim.add(token);
		if (isDistinctiveCasing(token)) {
			const lower = token.toLowerCase();
			if (!distinctive.has(lower)) distinctive.set(lower, token);
		}
	}
	return title.replace(TITLE_WORD, token => {
		if (verbatim.has(token)) return token;
		const restored = distinctive.get(token.toLowerCase());
		if (restored) return restored;
		return isCamelArtifact(token) ? token.toLowerCase() : token;
	});
}

/** Casing richer than a leading capital -- interior or repeated uppercase
 *  (`TinyVMM`, `iOS`, `API`). Worth restoring from the user's message. */
function isDistinctiveCasing(token: string): boolean {
	return /\p{L}\p{Lu}/u.test(token);
}

/** A lowercase word carrying a stray interior capital (`dAemon`, `cReate`): the
 *  model-mangled shape we flatten when the user never wrote it. PascalCase proper
 *  nouns (`GitHub`, `OAuth`) start uppercase and are left untouched. */
function isCamelArtifact(token: string): boolean {
	return /^\p{Ll}/u.test(token) && /\p{Lu}/u.test(token);
}

function extractGeneratedTitle(contentBlocks: AssistantMessage["content"]): string {
	let textTitle = "";
	for (const content of contentBlocks) {
		if (content.type === "toolCall" && content.name === SET_TITLE_TOOL_NAME) {
			const args = content.arguments as Record<string, unknown>;
			const title = args.title;
			return typeof title === "string" ? title.trim() : "";
		}
		if (content.type === "text") {
			textTitle += content.text;
		}
	}
	// Plain-text fallback (no set_title tool call): only accept it if it actually
	// looks like a title. A model that ignored the tool and rambled produces a long
	// blob — reject it so the caller falls back rather than persisting the narrative.
	const trimmed = textTitle.trim();
	if (trimmed.length > MAX_TITLE_CHARS || trimmed.split(/\s+/).length > MAX_TITLE_WORDS) {
		return "";
	}
	return trimmed;
}

/**
 * Remove control characters so model-generated titles cannot inject terminal escapes.
 */
function sanitizeTerminalTitlePart(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const sanitized = value.replace(TERMINAL_TITLE_CONTROL_CHARS, "").trim();
	return sanitized || undefined;
}

function getFallbackTerminalTitle(cwd: string | undefined): string | undefined {
	if (!cwd) return undefined;
	const resolvedCwd = path.resolve(cwd);
	const baseName = path.basename(resolvedCwd);
	if (!baseName || baseName === path.parse(resolvedCwd).root) return undefined;
	return sanitizeTerminalTitlePart(baseName);
}

export function formatSessionTerminalTitle(sessionName: string | undefined, cwd?: string): string {
	const label = sanitizeTerminalTitlePart(sessionName) ?? getFallbackTerminalTitle(cwd);
	return label ? `${DEFAULT_TERMINAL_TITLE}: ${label}` : DEFAULT_TERMINAL_TITLE;
}

/**
 * Set the terminal title using OSC 0 (sets both tab and window title). Unsupported terminals ignore it.
 */
export function setTerminalTitle(title: string): void {
	if (!process.stdout.isTTY) return;
	process.stdout.write(`\x1b]0;${sanitizeTerminalTitlePart(title) ?? DEFAULT_TERMINAL_TITLE}\x07`);
}

export function setSessionTerminalTitle(sessionName: string | undefined, cwd?: string): void {
	// An authoritative session title always wins over a transient extension override.
	terminalTitleRuntime.extensionOverride = undefined;
	terminalTitleRuntime.label = sanitizeTerminalTitlePart(sessionName) ?? getFallbackTerminalTitle(cwd);
	emitTerminalTitle();
}

/**
 * Set the terminal title from an extension's `setTitle()`. Unlike the session base
 * title this owns the terminal verbatim, so a spinner tick or state change cannot
 * rewrite it. Cleared as soon as the app establishes an authoritative session title
 * via {@link setSessionTerminalTitle} (rename, new session, session switch).
 */
export function setExtensionTerminalTitle(title: string): void {
	terminalTitleRuntime.extensionOverride = title;
	emitTerminalTitle();
}

export type TerminalTitleState = "idle" | "working" | "attention";

/**
 * Separator glyphs carrying the run state between the brand and the session label.
 * The brand itself stays bare — the separator slot expresses the state instead.
 * Spinner frames are declared locally rather than read from the theme's symbol set:
 * importing that here would create a `utils -> modes` cycle.
 */
const TITLE_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const TITLE_SPINNER_INTERVAL_MS = 80;
/** The user's turn: the title reads like a shell prompt awaiting input. */
const TITLE_IDLE_SEPARATOR = ">";
/** The agent is blocked on the user (ask / approval prompt). */
const TITLE_ATTENTION_SEPARATOR = "!";

const terminalTitleRuntime: {
	label: string | undefined;
	state: TerminalTitleState;
	frame: number;
	enabled: boolean;
	timer: NodeJS.Timeout | undefined;
	lastEmitted: string | undefined;
	extensionOverride: string | undefined;
} = {
	label: undefined,
	state: "idle",
	frame: 0,
	enabled: true,
	timer: undefined,
	lastEmitted: undefined,
	extensionOverride: undefined,
};

/**
 * Compose the terminal title from the brand, a state-carrying separator, and the
 * session label. Pure (no I/O) so the state->separator contract is unit-testable:
 *   - `idle` (your turn): `🦈 > label`
 *   - `working`:          `🦈 ⠋ label`  — spinner frames animate the separator
 *   - `attention`:        `🦈 ! label`  — agent blocked on you
 *   - disabled:           `🦈: label`   — the pre-state layout
 * Without a label the separator trails the brand (`🦈 >`) so the state stays visible.
 */
export function buildTerminalTitleWithState(
	label: string | undefined,
	state: TerminalTitleState,
	frame: number,
	enabled: boolean,
): string {
	if (!enabled) return label ? `${DEFAULT_TERMINAL_TITLE}: ${label}` : DEFAULT_TERMINAL_TITLE;
	const separator =
		state === "working"
			? TITLE_SPINNER_FRAMES[frame % TITLE_SPINNER_FRAMES.length]
			: state === "attention"
				? TITLE_ATTENTION_SEPARATOR
				: TITLE_IDLE_SEPARATOR;
	return label ? `${DEFAULT_TERMINAL_TITLE} ${separator} ${label}` : `${DEFAULT_TERMINAL_TITLE} ${separator}`;
}

function emitTerminalTitle(): void {
	// An extension override owns the terminal verbatim; spinner ticks and state
	// changes must not clobber it. Still deduped through `lastEmitted`.
	const next =
		terminalTitleRuntime.extensionOverride ??
		buildTerminalTitleWithState(
			terminalTitleRuntime.label,
			terminalTitleRuntime.state,
			terminalTitleRuntime.frame,
			terminalTitleRuntime.enabled,
		);
	if (next === terminalTitleRuntime.lastEmitted) return;
	terminalTitleRuntime.lastEmitted = next;
	setTerminalTitle(next);
}

function stopTerminalTitleSpinner(): void {
	if (terminalTitleRuntime.timer) {
		clearInterval(terminalTitleRuntime.timer);
		terminalTitleRuntime.timer = undefined;
	}
}

function startTerminalTitleSpinner(): void {
	if (terminalTitleRuntime.timer || !process.stdout.isTTY) return;
	terminalTitleRuntime.timer = setInterval(() => {
		terminalTitleRuntime.frame = (terminalTitleRuntime.frame + 1) % TITLE_SPINNER_FRAMES.length;
		emitTerminalTitle();
	}, TITLE_SPINNER_INTERVAL_MS);
	// Never keep the event loop alive for a cosmetic animation.
	terminalTitleRuntime.timer.unref?.();
}

/**
 * Reflect the agent run state in the terminal title's separator. Gated off by the
 * `tui.titleState` setting.
 */
export function setTerminalTitleState(state: TerminalTitleState): void {
	terminalTitleRuntime.state = state;
	if (state === "working" && terminalTitleRuntime.enabled) startTerminalTitleSpinner();
	else stopTerminalTitleSpinner();
	emitTerminalTitle();
}

/** Enable/disable the run-state separator (driven by the `tui.titleState` setting). */
export function setTerminalTitleStateEnabled(enabled: boolean): void {
	terminalTitleRuntime.enabled = enabled;
	if (enabled && terminalTitleRuntime.state === "working") startTerminalTitleSpinner();
	else stopTerminalTitleSpinner();
	emitTerminalTitle();
}

/**
 * Stop the spinner timer. Called on UI teardown BEFORE `popTerminalTitle()`, and
 * again from `stop()`; it is idempotent so the double call is harmless and no exit
 * path can leave a tick pending after the terminal is handed back to the shell.
 */
export function disposeTerminalTitleState(): void {
	stopTerminalTitleSpinner();
}

/** Test-only: reset module-level title runtime between cases. */
export function resetTerminalTitleStateForTest(): void {
	stopTerminalTitleSpinner();
	terminalTitleRuntime.label = undefined;
	terminalTitleRuntime.state = "idle";
	terminalTitleRuntime.frame = 0;
	terminalTitleRuntime.enabled = true;
	terminalTitleRuntime.lastEmitted = undefined;
	terminalTitleRuntime.extensionOverride = undefined;
}

/**
 * Save the current terminal title on terminals that support xterm window ops.
 */
export function pushTerminalTitle(): void {
	if (!process.stdout.isTTY) return;
	process.stdout.write("\x1b[22;2t");
}

/**
 * Restore the previously saved terminal title on terminals that support xterm window ops.
 */
export function popTerminalTitle(): void {
	if (!process.stdout.isTTY) return;
	process.stdout.write("\x1b[23;2t");
}
