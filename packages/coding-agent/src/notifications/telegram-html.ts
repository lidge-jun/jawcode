export const TELEGRAM_PARSE_MODE = "HTML" as const;
export const TELEGRAM_MESSAGE_LIMIT = 4096;

const ALLOWED_TAGS = new Set(["b", "i", "u", "s", "code", "pre", "a", "blockquote", "tg-spoiler"]);
const PLACEHOLDER_PREFIX = "\u0000jwc";
const PLACEHOLDER_SUFFIX = "\u0000";

export function escapeTelegramHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
	return escapeTelegramHtml(value).replace(/"/g, "&quot;");
}

function tag(name: string, escaped: string): string {
	return `<${name}>${escaped}</${name}>`;
}

function safeLink(url: string): boolean {
	return /^(https?:\/\/|mailto:)/i.test(url);
}

/** Convert a deliberately small, balanced Markdown subset to Telegram HTML. */
export function markdownToTelegramHtml(markdown: string): string {
	const placeholders: string[] = [];
	const stash = (html: string): string => {
		const token = `${PLACEHOLDER_PREFIX}${placeholders.length}${PLACEHOLDER_SUFFIX}`;
		placeholders.push(html);
		return token;
	};

	let text = markdown.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_match, body: string) =>
		stash(tag("pre", escapeTelegramHtml(body))),
	);
	text = text.replace(/`([^`\n]+)`/g, (_match, body: string) => stash(tag("code", escapeTelegramHtml(body))));
	text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (whole, label: string, url: string) =>
		safeLink(url) ? stash(`<a href="${escapeAttribute(url)}">${escapeTelegramHtml(label)}</a>`) : whole,
	);
	text = escapeTelegramHtml(text);

	const lines = text.split("\n");
	const rendered: string[] = [];
	let quote: string[] = [];
	const flushQuote = (): void => {
		if (quote.length > 0) rendered.push(tag("blockquote", quote.join("\n")));
		quote = [];
	};
	for (const line of lines) {
		const quoted = /^&gt;\s?(.*)$/.exec(line);
		if (quoted) {
			quote.push(quoted[1] ?? "");
			continue;
		}
		flushQuote();
		const heading = /^(#{1,6})\s+(.*)$/.exec(line);
		rendered.push(heading ? tag("b", heading[2] ?? "") : line);
	}
	flushQuote();
	text = rendered.join("\n");
	text = text.replace(/\*\*([^*\n]+)\*\*/g, (_match, body: string) => tag("b", body));
	text = text.replace(/\*([^*\n]+)\*/g, (_match, body: string) => tag("i", body));
	return text.replace(
		new RegExp(`${PLACEHOLDER_PREFIX}(\\d+)${PLACEHOLDER_SUFFIX}`, "g"),
		(_match, index: string) => placeholders[Number(index)] ?? "",
	);
}

interface HtmlToken {
	value: string;
	open?: string;
	openTag?: string;
	close?: string;
}

function tokenizeHtml(html: string): HtmlToken[] {
	const tokens: HtmlToken[] = [];
	let index = 0;
	while (index < html.length) {
		const char = html[index] ?? "";
		if (char === "<") {
			const end = html.indexOf(">", index);
			if (end !== -1) {
				const value = html.slice(index, end + 1);
				const closing = /^<\/([a-z-]+)>$/i.exec(value);
				const opening = /^<([a-z-]+)(?:\s[^>]*)?>$/i.exec(value);
				const token: HtmlToken = { value };
				if (closing && ALLOWED_TAGS.has((closing[1] ?? "").toLowerCase())) {
					token.close = (closing[1] ?? "").toLowerCase();
				} else if (opening && ALLOWED_TAGS.has((opening[1] ?? "").toLowerCase())) {
					token.open = (opening[1] ?? "").toLowerCase();
					token.openTag = value;
				}
				tokens.push(token);
				index = end + 1;
				continue;
			}
		}
		if (char === "&") {
			const end = html.indexOf(";", index);
			if (end !== -1 && end - index <= 10) {
				tokens.push({ value: html.slice(index, end + 1) });
				index = end + 1;
				continue;
			}
		}
		tokens.push({ value: char });
		index++;
	}
	return tokens;
}

interface OpenTag {
	name: string;
	tag: string;
}

/** Split rendered Telegram HTML without cutting tags or entities. */
export function splitTelegramHtml(message: string, max = TELEGRAM_MESSAGE_LIMIT): string[] {
	if (message.length <= max) return [message];
	const chunks: string[] = [];
	const stack: OpenTag[] = [];
	let output = "";
	let hasBody = false;
	const closers = (): string =>
		stack
			.map(item => `</${item.name}>`)
			.reverse()
			.join("");
	const openers = (): string => stack.map(item => item.tag).join("");
	const flush = (): void => {
		if (!hasBody) return;
		chunks.push(output + closers());
		output = openers();
		hasBody = false;
	};

	for (const token of tokenizeHtml(message)) {
		if (token.open) {
			const candidate = [...stack, { name: token.open, tag: token.openTag ?? token.value }];
			const candidateClosers = candidate
				.map(item => `</${item.name}>`)
				.reverse()
				.join("");
			if (hasBody && output.length + token.value.length + candidateClosers.length > max) flush();
			if (output.length + token.value.length + candidateClosers.length > max) continue;
			output += token.value;
			stack.push(candidate[candidate.length - 1] as OpenTag);
			hasBody = true;
			continue;
		}
		if (token.close) {
			const stackIndex = stack.findLastIndex(item => item.name === token.close);
			if (stackIndex === -1) continue;
			if (hasBody && output.length + token.value.length + closers().length > max) flush();
			output += token.value;
			stack.splice(stackIndex, 1);
			hasBody = true;
			continue;
		}
		if (hasBody && output.length + token.value.length + closers().length > max) flush();
		output += token.value;
		hasBody = true;
	}
	if (hasBody) chunks.push(output + closers());
	return chunks;
}
