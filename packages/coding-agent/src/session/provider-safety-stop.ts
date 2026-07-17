/**
 * Recognizes safety-stop labels persisted before `AssistantMessage.errorKind`.
 * Keep this anchored so incidental transport prose remains retryable.
 */
export function isLegacyProviderSafetyStopMessage(errorMessage: string): boolean {
	return /^(?:refusal(?: \([^()\s\r\n](?:[^()\r\n]*[^()\s\r\n])?\))?(?:: \S(?:[^\r\n]*\S)?)?|content flagged by safety filters|blocked under anthropic's usage policy\.|provider finish_reason: content_filter)[ \t]*(?![\s\S])/i.test(
		errorMessage,
	);
}
