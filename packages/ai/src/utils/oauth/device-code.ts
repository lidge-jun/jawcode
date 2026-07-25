const DEVICE_FLOW_CANCEL_MESSAGE = "Login cancelled";
const DEVICE_FLOW_TIMEOUT_MESSAGE = "Device flow timed out";
const DEVICE_FLOW_SLOW_DOWN_TIMEOUT_MESSAGE =
	"Device flow timed out after one or more slow_down responses. Check the system clock and try again.";
const MINIMUM_DEVICE_FLOW_INTERVAL_MS = 1000;
const DEFAULT_DEVICE_FLOW_INTERVAL_SECONDS = 5;
const SLOW_DOWN_INTERVAL_INCREMENT_MS = 5000;

export type OAuthDeviceCodePollResult<T> =
	| { status: "complete"; value: T }
	| { status: "pending" }
	| { status: "slow_down" }
	| { status: "failed"; message: string };

export interface OAuthDeviceCodeFlowOptions<T> {
	poll(): OAuthDeviceCodePollResult<T> | Promise<OAuthDeviceCodePollResult<T>>;
	intervalSeconds?: number;
	expiresInSeconds?: number;
	signal?: AbortSignal;
}

async function abortableDeviceFlowSleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
	if (!signal) {
		await Bun.sleep(ms);
		return;
	}
	if (signal.aborted) throw new Error(DEVICE_FLOW_CANCEL_MESSAGE);

	const { promise, resolve, reject } = Promise.withResolvers<void>();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const onAbort = () => {
		if (timer) clearTimeout(timer);
		reject(new Error(DEVICE_FLOW_CANCEL_MESSAGE));
	};
	timer = setTimeout(resolve, ms);
	signal.addEventListener("abort", onAbort, { once: true });
	try {
		await promise;
	} finally {
		if (timer) clearTimeout(timer);
		signal.removeEventListener("abort", onAbort);
	}
}

/** Poll an RFC 8628 OAuth device-code flow until completion, failure, timeout, or cancellation. */
export async function pollOAuthDeviceCodeFlow<T>(options: OAuthDeviceCodeFlowOptions<T>): Promise<T> {
	const deadline =
		typeof options.expiresInSeconds === "number"
			? Date.now() + options.expiresInSeconds * 1000
			: Number.POSITIVE_INFINITY;
	let intervalMs = Math.max(
		MINIMUM_DEVICE_FLOW_INTERVAL_MS,
		Math.floor((options.intervalSeconds ?? DEFAULT_DEVICE_FLOW_INTERVAL_SECONDS) * 1000),
	);
	let receivedSlowDown = false;

	while (Date.now() < deadline) {
		if (options.signal?.aborted) throw new Error(DEVICE_FLOW_CANCEL_MESSAGE);

		const result = await options.poll();
		if (result.status === "complete") return result.value;
		if (result.status === "failed") throw new Error(result.message);
		if (result.status === "slow_down") {
			receivedSlowDown = true;
			intervalMs += SLOW_DOWN_INTERVAL_INCREMENT_MS;
		}

		const remainingMs = deadline - Date.now();
		if (remainingMs <= 0) break;
		await abortableDeviceFlowSleep(Math.min(intervalMs, remainingMs), options.signal);
	}

	throw new Error(receivedSlowDown ? DEVICE_FLOW_SLOW_DOWN_TIMEOUT_MESSAGE : DEVICE_FLOW_TIMEOUT_MESSAGE);
}
