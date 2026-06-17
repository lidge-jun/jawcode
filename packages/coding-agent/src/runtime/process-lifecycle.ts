/**
 * Shared runtime lifecycle primitives for spawned children and retained resources.
 *
 * Subsystems adopt these incrementally so child processes and long-lived handles
 * cannot outlive their owning runtime.
 */
import { logger, postmortem, ptree } from "@jawcode-dev/utils";

const DEFAULT_GRACEFUL_MS = 2_000;
const SIGKILL_REAP_CAP_MS = 2_000;
const ROOT_EXIT_DRAIN_MS = 250;
const POLL_INTERVAL_MS = 20;

type OwnedStdin = "pipe" | "ignore" | Buffer | Uint8Array | null;

const isPosix = process.platform !== "win32";

export interface SpawnOwnedOptions<In extends OwnedStdin = OwnedStdin> {
	cwd?: string;
	env?: Record<string, string | undefined>;
	stdin?: In;
	stderr?: "full" | null;
	signal?: AbortSignal;
	gracefulMs?: number;
	processGroup?: boolean;
	name?: string;
}

export interface AwaitExitResult {
	exited: boolean;
	code: number | null;
}

export interface OwnedProcess<In extends OwnedStdin = OwnedStdin> {
	readonly child: ptree.ChildProcess<In>;
	readonly pid: number | undefined;
	readonly exited: Promise<number>;
	readonly disposed: boolean;
	awaitExit(opts?: { timeoutMs?: number }): Promise<AwaitExitResult>;
	dispose(): Promise<void>;
}

const liveOwners = new Set<OwnedProcess>();
let ownedPostmortemRegistered = false;

function delay(ms: number): Promise<void> {
	return Bun.sleep(Math.max(0, ms));
}

function groupAlive(pgid: number): boolean {
	try {
		process.kill(-pgid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

async function pollUntil(predicate: () => boolean, timeoutMs: number, intervalMs = POLL_INTERVAL_MS): Promise<boolean> {
	if (predicate()) return true;
	const deadline = Date.now() + Math.max(0, timeoutMs);
	while (Date.now() < deadline) {
		await delay(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
		if (predicate()) return true;
	}
	return predicate();
}

function ensureOwnedPostmortem(): void {
	if (ownedPostmortemRegistered) return;
	ownedPostmortemRegistered = true;
	postmortem.register("runtime:owned-processes", async () => {
		await Promise.all([...liveOwners].map(owner => owner.dispose().catch(() => undefined)));
	});
}

export function spawnOwnedProcess<In extends OwnedStdin = "ignore">(
	cmd: string[],
	opts: SpawnOwnedOptions<In> = {},
): OwnedProcess<In> {
	const gracefulMs = opts.gracefulMs ?? DEFAULT_GRACEFUL_MS;
	const useGroup = (opts.processGroup ?? true) && isPosix;
	ensureOwnedPostmortem();

	const child = ptree.spawn<In>(cmd, {
		cwd: opts.cwd,
		env: opts.env,
		stdin: opts.stdin ?? ("ignore" as In),
		stderr: opts.stderr,
		detached: useGroup,
	});
	const pgid = useGroup ? child.pid : undefined;

	let disposed = false;
	let disposePromise: Promise<void> | undefined;
	let deregistered = false;
	let terminated = false;
	let onAbort: (() => void) | undefined;

	const removeAbort = (): void => {
		if (!onAbort || !opts.signal) return;
		opts.signal.removeEventListener("abort", onAbort);
		onAbort = undefined;
	};

	const deregister = (): void => {
		if (deregistered) return;
		deregistered = true;
		terminated = true;
		liveOwners.delete(owner);
		removeAbort();
	};

	const signalTree = (signal: NodeJS.Signals): void => {
		const pid = child.pid;
		if (pid === undefined) return;
		if (pgid !== undefined) {
			try {
				process.kill(-pgid, signal);
			} catch {
				/* already gone */
			}
			return;
		}
		if (signal === "SIGKILL") {
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				/* already gone */
			}
			return;
		}
		child.kill();
	};

	const owner: OwnedProcess<In> = {
		child,
		get pid() {
			return child.pid;
		},
		get exited() {
			return child.exited;
		},
		get disposed() {
			return disposed;
		},
		async awaitExit({ timeoutMs }: { timeoutMs?: number } = {}): Promise<AwaitExitResult> {
			const exitedResult = child.exited
				.then(code => ({ exited: true, code: code as number | null }))
				.catch(() => ({ exited: true, code: child.exitCode }));
			if (timeoutMs === undefined) return await exitedResult;
			let timer: NodeJS.Timeout | undefined;
			const timeout = new Promise<AwaitExitResult>(resolve => {
				timer = setTimeout(() => resolve({ exited: false, code: child.exitCode }), Math.max(0, timeoutMs));
				timer.unref?.();
			});
			try {
				return await Promise.race([exitedResult, timeout]);
			} finally {
				if (timer) clearTimeout(timer);
			}
		},
		dispose(): Promise<void> {
			if (terminated) {
				disposed = true;
				disposePromise ??= Promise.resolve();
				return disposePromise;
			}
			if (disposePromise) return disposePromise;
			disposed = true;
			removeAbort();
			disposePromise = (async () => {
				try {
					if (pgid !== undefined) {
						if (!groupAlive(pgid)) return;
						signalTree("SIGTERM");
						if (await pollUntil(() => !groupAlive(pgid), gracefulMs)) return;
						signalTree("SIGKILL");
						if (!(await pollUntil(() => !groupAlive(pgid), SIGKILL_REAP_CAP_MS))) {
							logger.warn("owned process group still alive after SIGKILL", {
								name: opts.name,
								pgid,
							});
						}
						return;
					}
					if (child.exitCode !== null) return;
					signalTree("SIGTERM");
					const exited = await owner.awaitExit({ timeoutMs: gracefulMs });
					if (exited.exited) return;
					signalTree("SIGKILL");
					await owner.awaitExit({ timeoutMs: SIGKILL_REAP_CAP_MS });
				} finally {
					deregister();
				}
			})();
			return disposePromise;
		},
	};

	liveOwners.add(owner);

	child.exited
		.finally(() => {
			if (disposed || terminated || pgid === undefined) {
				deregister();
				return;
			}
			void (async () => {
				await delay(ROOT_EXIT_DRAIN_MS);
				if (!groupAlive(pgid)) deregister();
			})();
		})
		.catch(() => undefined);

	onAbort = () => {
		void owner.dispose();
	};
	if (opts.signal?.aborted) {
		void owner.dispose();
	} else {
		opts.signal?.addEventListener("abort", onAbort, { once: true });
	}

	return owner;
}

export function registerResourceOwner(name: string, dispose: () => void | Promise<void>): () => void {
	let disposed = false;
	const cleanup = async (): Promise<void> => {
		if (disposed) return;
		disposed = true;
		await dispose();
	};
	const unregister = postmortem.register(`runtime:${name}`, () => cleanup());
	return () => {
		if (disposed) return;
		disposed = true;
		unregister();
	};
}
