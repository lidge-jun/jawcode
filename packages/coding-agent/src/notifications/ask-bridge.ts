/**
 * Bridges a live local answer source against a remote notification answer for a single ask.
 *
 * Transport-agnostic and TUI-free so it can be unit-tested in isolation: the caller supplies the
 * local answer promise (already wired to whatever UI it uses) and a mapper from a remote string to
 * the caller's own answer shape. The local side is cancelled via `dismiss` when the remote wins.
 */

export interface AskBridgeServer {
	enqueueAction(draft: {
		actionId: string;
		prompt: string;
		options?: readonly string[];
		allowFreeText?: boolean;
	}): unknown;
	resolveLocal(actionId: string): unknown;
	setOnRemoteResolved(callback: (actionId: string, value: string) => void): void;
}

export interface BridgeAskOptions<T> {
	actionId: string;
	prompt: string;
	options?: readonly string[];
	allowFreeText?: boolean;
	/** The local answer promise (e.g. the TUI select), wired to abort on `dismiss`. */
	local: Promise<T>;
	/** Aborted when the remote side wins, to cancel/dismiss the local prompt. */
	dismiss: AbortController;
	/** Map a remote answer string into the caller's local answer shape. */
	onRemote: (value: string) => T;
}

/**
 * Enqueue an ask on the server, then race the local answer against a remote reply for `actionId`.
 * Local win → `resolveLocal` (so a late remote reply is rejected) and returns the local result.
 * Remote win → aborts `dismiss` (cancelling the local prompt) and returns `onRemote(value)`.
 * The remote subscription is always cleared before returning.
 */
export async function bridgeAsk<T>(server: AskBridgeServer, options: BridgeAskOptions<T>): Promise<T> {
	const { promise: remotePromise, resolve: resolveRemote } = Promise.withResolvers<string>();
	server.setOnRemoteResolved((actionId, value) => {
		if (actionId === options.actionId) resolveRemote(value);
	});
	server.enqueueAction({
		actionId: options.actionId,
		prompt: options.prompt,
		options: options.options,
		allowFreeText: options.allowFreeText,
	});

	// localTagged never rejects: a post-race local rejection (e.g. dismiss abort) is captured here
	// so it cannot surface as an unhandled rejection after the remote side has won.
	const localTagged = options.local
		.then(result => ({ kind: "local" as const, result }))
		.catch((error: unknown) => ({ kind: "localError" as const, error }));
	const remoteTagged = remotePromise.then(value => ({ kind: "remote" as const, value }));

	try {
		const winner = await Promise.race([localTagged, remoteTagged]);

		if (winner.kind === "remote") {
			options.dismiss.abort();
			void localTagged; // already catches the resulting local rejection
			return options.onRemote(winner.value);
		}

		// Local side settled first (answer or error): mark resolved so a late remote reply is rejected.
		server.resolveLocal(options.actionId);
		if (winner.kind === "localError") throw winner.error;
		return winner.result;
	} finally {
		server.setOnRemoteResolved(() => {}); // clear the single-shot subscription
	}
}
