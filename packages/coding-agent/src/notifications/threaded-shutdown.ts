import { deleteForumTopic } from "./telegram-api";

export interface TopicDeletionResult {
	attempted: number;
	deleted: number;
	failed: number;
}

/**
 * Best-effort batch deletion of per-session Telegram forum topics on shutdown. Every delete is
 * isolated (a failure is tallied, never thrown) so cleanup can never break a clean stop. The bot token
 * is never logged.
 */
export async function deleteSessionTopics(opts: {
	token: string;
	chatId: string;
	topics: ReadonlyArray<{ messageThreadId: number }>;
	deleteImpl?: typeof deleteForumTopic;
}): Promise<TopicDeletionResult> {
	const deleteImpl = opts.deleteImpl ?? deleteForumTopic;
	let deleted = 0;
	let failed = 0;
	for (const topic of opts.topics) {
		try {
			const outcome = await deleteImpl({
				token: opts.token,
				chatId: opts.chatId,
				messageThreadId: topic.messageThreadId,
			});
			if (outcome.ok) deleted += 1;
			else failed += 1;
		} catch {
			failed += 1;
		}
	}
	return { attempted: opts.topics.length, deleted, failed };
}
