import type { NotificationServerFrame, NotificationTurnStreamFrame } from "./protocol";
import { editTelegramMessage, sendTelegramMessage } from "./telegram-api";
import { markdownToTelegramHtml, splitTelegramHtml, TELEGRAM_PARSE_MODE } from "./telegram-html";

export interface TelegramTurnDeliveryOptions {
	token: string;
	chatId: string;
	fetchImpl?: typeof fetch;
}

/** Ordered Telegram delivery for finalized turns and opt-in in-place live edits. */
export class TelegramTurnDelivery {
	readonly #options: TelegramTurnDeliveryOptions;
	readonly #messageIds = new Map<string, number>();
	#queue: Promise<void> = Promise.resolve();

	constructor(options: TelegramTurnDeliveryOptions) {
		this.#options = options;
	}

	deliver(frame: NotificationServerFrame): void {
		if (frame.type !== "turn_stream") return;
		this.#queue = this.#queue.then(() => this.#deliverTurn(frame)).catch(() => {});
	}

	async drain(): Promise<void> {
		await this.#queue;
	}

	async #deliverTurn(frame: NotificationTurnStreamFrame): Promise<void> {
		if (/^[.\s]+$/.test(frame.text)) return;
		const chunks = splitTelegramHtml(markdownToTelegramHtml(frame.text));
		const key = frame.messageRef ? `${frame.sessionId}:${frame.messageRef}` : undefined;
		const existingId = key ? this.#messageIds.get(key) : undefined;

		if (existingId !== undefined && chunks[0]) {
			const edited = await editTelegramMessage({
				token: this.#options.token,
				chatId: this.#options.chatId,
				messageId: existingId,
				text: chunks[0],
				parseMode: TELEGRAM_PARSE_MODE,
				fetchImpl: this.#options.fetchImpl,
			});
			if (edited.ok) {
				for (const chunk of chunks.slice(1)) await this.#sendChunk(chunk);
				if (frame.phase === "finalized" && key) this.#messageIds.delete(key);
				return;
			}
		}

		for (const [index, chunk] of chunks.entries()) {
			const messageId = await this.#sendChunk(chunk);
			if (index === 0 && key && messageId !== undefined) this.#messageIds.set(key, messageId);
		}
		if (frame.phase === "finalized" && key) this.#messageIds.delete(key);
	}

	async #sendChunk(text: string): Promise<number | undefined> {
		const sent = await sendTelegramMessage({
			token: this.#options.token,
			chatId: this.#options.chatId,
			text,
			parseMode: TELEGRAM_PARSE_MODE,
			fetchImpl: this.#options.fetchImpl,
		});
		return sent.ok ? sent.result.message_id : undefined;
	}
}
