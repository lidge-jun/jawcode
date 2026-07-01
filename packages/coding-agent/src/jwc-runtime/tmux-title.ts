import * as path from "node:path";
import type { JwcTmuxProfileCommand } from "./tmux-common";

export const JWC_TMUX_WINDOW_LABEL_MAX_WIDTH = 48;

const TERMINAL_TITLE_CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;
const JWC_TMUX_WINDOW_BRANCH_SEPARATOR = "-";
const JWC_TMUX_WINDOW_TITLE_PREFIX = "JWC-";
const JWC_TMUX_TERMINAL_TITLE_PREFIX = "JWC: ";

function visibleWidth(value: string): number {
	return Bun.stringWidth(value);
}

function truncateVisible(value: string, maxWidth: number): string {
	if (maxWidth <= 0) return "";
	if (visibleWidth(value) <= maxWidth) return value;
	if (maxWidth === 1) return "…";
	let result = "";
	for (const char of value) {
		if (visibleWidth(`${result}${char}…`) > maxWidth) break;
		result += char;
	}
	return `${result}…`;
}

function truncateVisibleTail(value: string, maxWidth: number): string {
	if (maxWidth <= 0) return "";
	if (visibleWidth(value) <= maxWidth) return value;
	if (maxWidth === 1) return "…";
	let result = "";
	for (const char of Array.from(value).reverse()) {
		if (visibleWidth(`…${char}${result}`) > maxWidth) break;
		result = `${char}${result}`;
	}
	return `…${result}`;
}

function sanitizeTmuxWindowTitleSegment(value: string): string {
	return value.replace(/:+/g, "-");
}

function sanitizeTmuxWindowProjectName(project: string): string {
	const trimmed = project.trim();
	if (!trimmed || /^\.+$/.test(trimmed)) return "jwc";
	if (trimmed.startsWith(".")) return sanitizeTmuxWindowTitleSegment(`dot-${trimmed.replace(/^\.+/, "")}`);
	return sanitizeTmuxWindowTitleSegment(trimmed);
}

function buildJwcTmuxPrefixedTitle(prefix: string, cwd: string, branch: string | null | undefined): string {
	const project = sanitizeTmuxWindowProjectName(path.basename(path.resolve(cwd)) || "jwc");
	const projectTitle = `${prefix}${project}`;
	const trimmedBranch = sanitizeTmuxWindowTitleSegment(branch?.trim() ?? "");
	if (!trimmedBranch) return truncateVisible(projectTitle, JWC_TMUX_WINDOW_LABEL_MAX_WIDTH);
	const separatorWidth = visibleWidth(JWC_TMUX_WINDOW_BRANCH_SEPARATOR);
	const projectWidth = visibleWidth(projectTitle);
	const fullTitle = `${projectTitle}${JWC_TMUX_WINDOW_BRANCH_SEPARATOR}${trimmedBranch}`;
	if (visibleWidth(fullTitle) <= JWC_TMUX_WINDOW_LABEL_MAX_WIDTH) return fullTitle;
	const remainingBranchWidth = JWC_TMUX_WINDOW_LABEL_MAX_WIDTH - projectWidth - separatorWidth;
	if (remainingBranchWidth <= 0) return truncateVisible(projectTitle, JWC_TMUX_WINDOW_LABEL_MAX_WIDTH);
	return `${projectTitle}${JWC_TMUX_WINDOW_BRANCH_SEPARATOR}${truncateVisibleTail(trimmedBranch, remainingBranchWidth)}`;
}

export function buildJwcTmuxWindowTitle(cwd: string, branch: string | null | undefined): string {
	return buildJwcTmuxPrefixedTitle(JWC_TMUX_WINDOW_TITLE_PREFIX, cwd, branch);
}

export function buildJwcTmuxRootTerminalTitle(cwd: string, branch: string | null | undefined): string {
	return buildJwcTmuxPrefixedTitle(JWC_TMUX_TERMINAL_TITLE_PREFIX, cwd, branch);
}

function sanitizeJwcTmuxRootTerminalTitle(title: string): string {
	return title.replace(TERMINAL_TITLE_CONTROL_CHARS, "").trim() || "JWC";
}

function escapeTmuxFormatLiteral(value: string): string {
	return value.replace(/#/g, "##");
}

export function buildJwcTmuxRootTerminalTitleCommands(target: string, title: string): JwcTmuxProfileCommand[] {
	const sanitized = escapeTmuxFormatLiteral(sanitizeJwcTmuxRootTerminalTitle(title));
	return [
		{ description: "enable tmux client terminal title", args: ["set-option", "-t", target, "set-titles", "on"] },
		{
			description: "set tmux client terminal title",
			args: ["set-option", "-t", target, "set-titles-string", sanitized],
		},
	];
}
