/**
 * A session that has started tearing down must stop being a delivery target.
 *
 * The SDK wraps `session.dispose` and unregisters from the agent registry in a
 * `finally` — i.e. only AFTER `originalDispose()` settles. Real dispose does
 * network and subprocess teardown, so that window is not instantaneous. For its
 * whole duration the ref still carries a live `session`, and
 * `listVisibleTo()` still reports the agent as `running`/`idle`, so `irc` will
 * pick it as a target and call `respondAsBackground` on a session that is
 * already shutting down.
 */
import { describe, expect, it } from "bun:test";
import { AgentRegistry } from "@jawcode-dev/coding-agent/registry/agent-registry";
import type { AgentSession } from "@jawcode-dev/coding-agent/session/agent-session";

/**
 * Mirrors the dispose wrapper in `sdk.ts`.
 *
 * Kept in sync with the real one deliberately: `createAgentSession` needs auth
 * storage, a model registry and network access, so the wrapper's ORDERING is
 * asserted here and the real call site is pinned by the source-shape test
 * below.
 */
function wrapDispose(registry: AgentRegistry, id: string, session: { dispose: () => Promise<void> }): void {
	const originalDispose = session.dispose.bind(session);
	session.dispose = async () => {
		registry.detachSession(id);
		try {
			await originalDispose();
		} finally {
			registry.unregister(id);
		}
	};
}

describe("agent registry visibility during dispose", () => {
	it("stops offering a disposing session as a delivery target", async () => {
		const registry = new AgentRegistry();
		registry.register({ id: "peer", displayName: "peer", kind: "main", session: null });
		registry.register({ id: "sender", displayName: "sender", kind: "main", session: null });

		// Dispose that takes real time, as network/subprocess teardown does.
		const { promise: disposeGate, resolve: finishDispose } = Promise.withResolvers<void>();
		const peerSession = { dispose: () => disposeGate };
		registry.attachSession("peer", peerSession as unknown as AgentSession);
		wrapDispose(registry, "peer", peerSession);

		const disposing = peerSession.dispose();
		await Bun.sleep(5);

		// Mid-dispose: what would `irc` see right now?
		const visible = registry.listVisibleTo("sender");
		const peerRef = visible.find(ref => ref.id === "peer");
		const deliverable = peerRef?.session != null;

		finishDispose();
		await disposing;

		expect(deliverable).toBe(false);
	});

	it("still delivers to a healthy peer", async () => {
		// The guard must not make every peer undeliverable.
		const registry = new AgentRegistry();
		registry.register({ id: "peer", displayName: "peer", kind: "main", session: null });
		registry.register({ id: "sender", displayName: "sender", kind: "main", session: null });
		registry.attachSession("peer", { dispose: async () => {} } as unknown as AgentSession);

		const peerRef = registry.listVisibleTo("sender").find(ref => ref.id === "peer");
		expect(peerRef?.session).not.toBeNull();
	});

	it("keeps the production dispose wrapper detaching before teardown", async () => {
		// Guards against the ordering above drifting from `sdk.ts`, which is the
		// only place that actually matters at runtime.
		const source = await Bun.file(new URL("../src/sdk.ts", import.meta.url).pathname).text();
		const wrapper = source.slice(source.indexOf("const originalDispose = session.dispose.bind(session);"));
		const detachAt = wrapper.indexOf("agentRegistry.detachSession(");
		const awaitAt = wrapper.indexOf("await originalDispose()");
		const unregisterAt = wrapper.indexOf("agentRegistry.unregister(");

		expect(detachAt).toBeGreaterThan(-1);
		expect(detachAt).toBeLessThan(awaitAt);
		expect(unregisterAt).toBeGreaterThan(awaitAt);
	});
});
