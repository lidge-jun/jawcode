/**
 * Streaming splitter for Kiro's fake-reasoning contract.
 *
 * `injectKiroThinkingTags` asks the model to emit a leading `<thinking>…</thinking>`
 * (also `<think>` / `<reasoning>`) block before its visible answer. CodeWhisperer has no
 * native reasoning channel, so that block arrives inline in the `content` stream. This parser
 * watches only a LEADING block (the model is instructed to think first) and classifies each
 * streamed fragment as either reasoning or visible text, tolerating tags split across chunks.
 *
 * It emits classified chunks; the caller maps them to jawcode `thinking_*` / `text_*` events.
 */

export type KiroThinkingChunk = { kind: "thinking"; text: string } | { kind: "text"; text: string };

type ThinkingTag = "<thinking>" | "<think>" | "<reasoning>";
type ParserState = "pre" | "thinking" | "streaming";

const OPEN_TAGS: ThinkingTag[] = ["<thinking>", "<think>", "<reasoning>"];
const MAX_OPEN_TAG = Math.max(...OPEN_TAGS.map(t => t.length));
const MAX_CLOSE_TAG = Math.max(...OPEN_TAGS.map(t => `</${t.slice(1)}`.length));

function closeTagFor(openTag: ThinkingTag): string {
	return `</${openTag.slice(1)}`;
}

function isPossibleOpenTagPrefix(text: string): boolean {
	return OPEN_TAGS.some(tag => tag.startsWith(text) && text.length < tag.length);
}

export class KiroThinkingParser {
	private state: ParserState = "pre";
	private preBuffer = "";
	private thinkingBuffer = "";
	private closeTag = "";

	feed(text: string): KiroThinkingChunk[] {
		if (!text) return [];
		if (this.state === "streaming") return [{ kind: "text", text }];
		if (this.state === "thinking") {
			this.thinkingBuffer += text;
			return this.drainThinking();
		}
		this.preBuffer += text;
		const stripped = this.preBuffer.trimStart();
		const openTag = OPEN_TAGS.find(tag => stripped.startsWith(tag));
		if (openTag) {
			this.state = "thinking";
			this.closeTag = closeTagFor(openTag);
			this.thinkingBuffer = stripped.slice(openTag.length);
			this.preBuffer = "";
			return this.drainThinking();
		}
		// Still possibly the beginning of an open tag — wait for more bytes before deciding.
		if (stripped.length <= MAX_OPEN_TAG && isPossibleOpenTagPrefix(stripped)) return [];
		this.state = "streaming";
		const out = this.preBuffer;
		this.preBuffer = "";
		return out ? [{ kind: "text", text: out }] : [];
	}

	flush(): KiroThinkingChunk[] {
		if (this.state === "thinking") {
			const out = this.thinkingBuffer;
			this.thinkingBuffer = "";
			this.state = "streaming";
			return out ? [{ kind: "thinking", text: out }] : [];
		}
		if (this.preBuffer) {
			const out = this.preBuffer;
			this.preBuffer = "";
			this.state = "streaming";
			return [{ kind: "text", text: out }];
		}
		return [];
	}

	private drainThinking(): KiroThinkingChunk[] {
		const close = this.closeTag;
		const idx = this.thinkingBuffer.indexOf(close);
		if (idx >= 0) {
			const thinking = this.thinkingBuffer.slice(0, idx);
			const after = this.thinkingBuffer.slice(idx + close.length).trimStart();
			this.thinkingBuffer = "";
			this.state = "streaming";
			const out: KiroThinkingChunk[] = [];
			if (thinking) out.push({ kind: "thinking", text: thinking });
			if (after) out.push({ kind: "text", text: after });
			return out;
		}
		// Hold back the maximum close-tag length so a tag split across chunks is not emitted as text.
		if (this.thinkingBuffer.length <= MAX_CLOSE_TAG) return [];
		const send = this.thinkingBuffer.slice(0, -MAX_CLOSE_TAG);
		this.thinkingBuffer = this.thinkingBuffer.slice(-MAX_CLOSE_TAG);
		return send ? [{ kind: "thinking", text: send }] : [];
	}
}
