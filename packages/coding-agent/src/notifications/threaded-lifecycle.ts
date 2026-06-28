/**
 * Pure decision for a session's Telegram threaded surface: reuse an existing forum topic, create a new
 * one, or fall back to the flat DM when forum topics are unavailable. `needsIdentity` is true only when
 * the identity header has not yet been sent for the topic, so it is emitted exactly once.
 */

export type TopicActionDecision =
	| { action: "reuse"; messageThreadId: number; needsIdentity: boolean }
	| { action: "create"; needsIdentity: true }
	| { action: "flat-fallback"; needsIdentity: boolean };

export function decideTopicAction(input: {
	threadedSupported: boolean;
	existing?: { messageThreadId: number; identitySent: boolean };
}): TopicActionDecision {
	if (!input.threadedSupported) {
		return { action: "flat-fallback", needsIdentity: !input.existing?.identitySent };
	}
	if (input.existing) {
		return {
			action: "reuse",
			messageThreadId: input.existing.messageThreadId,
			needsIdentity: !input.existing.identitySent,
		};
	}
	return { action: "create", needsIdentity: true };
}
