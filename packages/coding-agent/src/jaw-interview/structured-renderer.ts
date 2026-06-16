import { type Component, Container, Markdown, Spacer, Text } from "@gajae-code/tui";
import type { AskGateQuestionMeta } from "../modes/shared/agent-wire/jaw-interview-gate";
import { getMarkdownTheme, type Theme } from "../modes/theme/theme";

/**
 * Structured TUI renderer for jaw-interview questions (042 D040-3 / D041-A).
 *
 * Renders the round header from the ask tool's structured `meta` field instead of
 * regex-parsing a `Round N | ...` text protocol. Language-safe by construction:
 * no English keyword anchors, so Korean (or any) sessions render identically.
 */

export interface StructuredInterviewQuestion {
	question: string;
	meta: AskGateQuestionMeta;
}

function addLabel(container: Container, label: string, value: string | undefined, uiTheme: Theme): void {
	if (!value) return;
	container.addChild(new Spacer(1));
	container.addChild(new Text(uiTheme.fg("accent", uiTheme.bold(label)), 0, 0));
	container.addChild(
		new Markdown(value, 2, 0, getMarkdownTheme(), { color: (text: string) => uiTheme.fg("toolOutput", text) }),
	);
}

function formatAmbiguity(ambiguity: number | undefined): string | undefined {
	if (typeof ambiguity !== "number" || !Number.isFinite(ambiguity)) return undefined;
	const percent = ambiguity <= 1 ? ambiguity * 100 : ambiguity;
	return `${Math.round(percent * 10) / 10}%`;
}

function headerLine(meta: AskGateQuestionMeta): string {
	if (meta.kind === "topology" || meta.round === 0) {
		return "Jaw Interview · Round 0 · Topology confirmation";
	}
	const parts = [
		typeof meta.round === "number" ? `Round ${meta.round}` : undefined,
		formatAmbiguity(meta.ambiguity) ? `Ambiguity ${formatAmbiguity(meta.ambiguity)}` : undefined,
	].filter(Boolean);
	return parts.length > 0 ? `Jaw Interview · ${parts.join(" · ")}` : "Jaw Interview";
}

/** Render one structured interview question for tool-call display. */
export function renderInterviewQuestion(input: StructuredInterviewQuestion, uiTheme: Theme): Component {
	const { question, meta } = input;
	const container = new Container();
	container.addChild(new Text(uiTheme.fg("toolTitle", uiTheme.bold(headerLine(meta))), 0, 0));
	if (meta.kind === "topology" || meta.round === 0) {
		addLabel(container, "Ambiguity", "Not scored yet", uiTheme);
	}
	addLabel(container, "Component", meta.component, uiTheme);
	addLabel(container, "Mode", meta.mode, uiTheme);
	addLabel(container, "Target", meta.targeting, uiTheme);
	addLabel(container, "Why now", meta.whyNow, uiTheme);
	addLabel(container, "Question", question, uiTheme);
	return container;
}

/** Plain-text selector prompt built from structured meta (selector dialogs take a string). */
export function formatInterviewSelectorPrompt(input: StructuredInterviewQuestion): string {
	const { question, meta } = input;
	if (meta.kind === "topology" || meta.round === 0) {
		return ["Jaw Interview · Round 0 · Topology confirmation", "Ambiguity: not scored yet", question]
			.filter(Boolean)
			.join("\n\n");
	}
	return [
		headerLine(meta),
		meta.component ? `Component: ${meta.component}` : undefined,
		meta.mode ? `Mode: ${meta.mode}` : undefined,
		meta.targeting ? `Target: ${meta.targeting}` : undefined,
		meta.whyNow ? `Why now: ${meta.whyNow}` : undefined,
		question,
	]
		.filter((line): line is string => Boolean(line))
		.join("\n");
}

/** Questions with structured meta get numbered options, mirroring the legacy behavior. */
export function isStructuredInterviewQuestion(meta: AskGateQuestionMeta | undefined): meta is AskGateQuestionMeta {
	return Boolean(meta && (meta.kind === "round" || meta.kind === "topology" || typeof meta.round === "number"));
}
