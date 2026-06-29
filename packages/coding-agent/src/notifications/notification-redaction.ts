/**
 * Remote notification redaction (chase 10.032, gate 4 + gate 6 lead-in).
 *
 * Invariant: when redaction is on, the streamed assistant/tool/context text is
 * redacted, but the ask *question and options stay verbatim* so the user can
 * still act on the prompt remotely. The assistant lead-in (pre-ask text) obeys
 * redaction. Pure / side-effect-free; transport-agnostic.
 */

export interface RedactionPolicy {
	redact: boolean;
}

export const REDACTED_PLACEHOLDER = "[redacted]";

/**
 * Redact free streamed/context text. Returns the text verbatim when redaction
 * is off; when on, returns the placeholder for non-empty text and "" for
 * empty/whitespace (never emit a placeholder for nothing).
 */
export function redactStreamText(text: string, policy: RedactionPolicy): string {
	if (!policy.redact) return text;
	return text.trim().length === 0 ? "" : REDACTED_PLACEHOLDER;
}

export interface RemoteAskView {
	leadIn?: string;
	question: string;
	options: string[];
}

export interface BuildRemoteAskViewInput {
	question: string;
	options: readonly string[];
	/** Assistant pre-ask text (gate 6); obeys redaction. */
	leadIn?: string;
	policy: RedactionPolicy;
}

/**
 * Build the remote-facing view of an ask. The question and options are emitted
 * verbatim regardless of redaction (gate 4); the lead-in is redacted when the
 * policy says so and omitted entirely when empty.
 */
export function buildRemoteAskView(input: BuildRemoteAskViewInput): RemoteAskView {
	const options = input.options.filter(opt => opt.trim().length > 0);
	const view: RemoteAskView = {
		question: input.question,
		options,
	};

	const rawLeadIn = input.leadIn ?? "";
	const leadIn = redactStreamText(rawLeadIn, input.policy);
	if (leadIn.trim().length > 0) view.leadIn = leadIn;

	return view;
}
