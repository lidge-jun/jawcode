import {
	type SendTelegramFileOptions,
	sendTelegramDocument,
	sendTelegramPhoto,
	type TelegramCallOutcome,
} from "./telegram-api";
import { classifyTelegramMedia, type TelegramMediaRejectionReason } from "./telegram-media-policy";

/**
 * Outbound Telegram media render (chase 10.034, done-gate 1). Classifies a
 * workspace-confined file by size/extension and dispatches it to the matching
 * Telegram multipart sender (`sendPhoto` for in-policy images, `sendDocument`
 * otherwise). The file MUST already be resolved through
 * `resolveWorkspaceFileForNotification`; this function does not touch the
 * filesystem. Rejections from the size/MIME policy short-circuit before any
 * network call, so an oversize or empty file never egresses.
 */
export interface RenderTelegramMediaInput extends SendTelegramFileOptions {}

export type RenderTelegramMediaResult =
	| { ok: true; method: "sendPhoto" | "sendDocument"; result: { message_id: number } }
	| { ok: false; rejected: TelegramMediaRejectionReason }
	| (TelegramCallOutcome<{ message_id: number }> & { ok: false; rejected?: undefined });

export async function renderAndSendTelegramMedia(input: RenderTelegramMediaInput): Promise<RenderTelegramMediaResult> {
	const decision = classifyTelegramMedia({
		fileName: input.fileName,
		sizeBytes: input.data.length,
	});
	if (!decision.ok) {
		return { ok: false, rejected: decision.reason };
	}

	const outcome = decision.method === "sendPhoto" ? await sendTelegramPhoto(input) : await sendTelegramDocument(input);

	if (outcome.ok) {
		return { ok: true, method: decision.method, result: outcome.result };
	}
	return outcome;
}
