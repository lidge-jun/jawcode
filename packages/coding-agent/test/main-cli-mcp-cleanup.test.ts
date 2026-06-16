import { afterEach, describe, expect, it } from "bun:test";
import * as path from "node:path";
import { TempDir } from "@jawcode-dev/utils";
import type { Args } from "../src/cli/args";
import { Settings } from "../src/config/settings";
import { MCPManager, type MCPToolsLoadResult } from "../src/runtime-mcp";
import type { CreateAgentSessionOptions, CreateAgentSessionResult } from "../src/sdk";
import type { AgentSession } from "../src/session/agent-session";
import { AuthStorage } from "../src/session/auth-storage";

function args(mode: Args["mode"] = "json"): Args {
	return {
		mode,
		messages: [],
		fileArgs: [],
		unknownFlags: new Map(),
		noSkills: true,
		noRules: true,
		noTools: true,
		noLsp: true,
	};
}

function fakeManager(onDisconnect: () => void): MCPManager {
	return {
		disconnectAll: async () => {
			onDisconnect();
		},
	} as unknown as MCPManager;
}

function loadResult(manager: MCPManager): MCPToolsLoadResult {
	return {
		manager,
		tools: [],
		errors: [],
		connectedServers: [],
		exaApiKeys: [],
	};
}

async function authStorageFor(dir: string): Promise<AuthStorage> {
	return await AuthStorage.create(path.join(dir, "auth.db"));
}

function fakeSessionResult(options: {
	manager?: MCPManager;
	model?: AgentSession["model"];
	onDispose: () => void;
}): CreateAgentSessionResult {
	const session = {
		model: options.model,
		extensionRunner: undefined,
		dispose: async () => {
			options.onDispose();
			if (options.manager) {
				await options.manager.disconnectAll();
				if (MCPManager.instance() === options.manager) {
					MCPManager.setInstance(undefined);
				}
			}
		},
		refreshMCPTools: async () => {},
	} as unknown as AgentSession;
	return {
		session,
		extensionsResult: {} as CreateAgentSessionResult["extensionsResult"],
		setToolUIContext: () => {},
		eventBus: {} as CreateAgentSessionResult["eventBus"],
	};
}

function fakeModel(): AgentSession["model"] {
	return { provider: "test" } as AgentSession["model"];
}

describe("runRootCommand MCP cleanup ownership", () => {
	afterEach(() => {
		MCPManager.resetForTests();
	});

	it("disconnects CLI-owned MCP manager when session creation throws", async () => {
		using tempDir = TempDir.createSync("@jwc-main-mcp-cleanup-");
		let disconnects = 0;
		const manager = fakeManager(() => {
			disconnects++;
		});
		MCPManager.setInstance(manager);
		const { runRootCommand } = await import("../src/main");

		await expect(
			runRootCommand(args("json"), [], {
				discoverAuthStorage: () => authStorageFor(tempDir.path()),
				settings: Settings.isolated({ "marketplace.autoUpdate": "off" }),
				buildSessionOptions: async () => ({ options: {} as CreateAgentSessionOptions }),
				discoverAndLoadMCPTools: async () => loadResult(manager),
				createAgentSession: async () => {
					throw new Error("stop before session");
				},
			}),
		).rejects.toThrow("stop before session");

		expect(disconnects).toBe(1);
		expect(MCPManager.instance()).toBeUndefined();
	});

	it("does not disconnect externally supplied MCP manager when session creation throws", async () => {
		using tempDir = TempDir.createSync("@jwc-main-mcp-external-");
		let externalDisconnects = 0;
		let discoveryCalls = 0;
		const externalManager = fakeManager(() => {
			externalDisconnects++;
		});
		const { runRootCommand } = await import("../src/main");

		await expect(
			runRootCommand(args("json"), [], {
				discoverAuthStorage: () => authStorageFor(tempDir.path()),
				settings: Settings.isolated({ "marketplace.autoUpdate": "off" }),
				buildSessionOptions: async () => ({
					options: { mcpManager: externalManager } as CreateAgentSessionOptions,
				}),
				discoverAndLoadMCPTools: async () => {
					discoveryCalls++;
					return loadResult(fakeManager(() => {}));
				},
				createAgentSession: async () => {
					throw new Error("stop external");
				},
			}),
		).rejects.toThrow("stop external");

		expect(discoveryCalls).toBe(0);
		expect(externalDisconnects).toBe(0);
	});

	it("skips normal CLI MCP discovery for ACP mode", async () => {
		using tempDir = TempDir.createSync("@jwc-main-mcp-acp-");
		let discoveryCalls = 0;
		const { runRootCommand } = await import("../src/main");

		await expect(
			runRootCommand(args("acp"), [], {
				discoverAuthStorage: () => authStorageFor(tempDir.path()),
				settings: Settings.isolated({ "marketplace.autoUpdate": "off" }),
				buildSessionOptions: async () => ({ options: {} as CreateAgentSessionOptions }),
				discoverAndLoadMCPTools: async () => {
					discoveryCalls++;
					return loadResult(fakeManager(() => {}));
				},
				runAcpMode: async () => {
					throw new Error("stop acp");
				},
			}),
		).rejects.toThrow("stop acp");

		expect(discoveryCalls).toBe(0);
	});
	it("disposes a created session and disconnects MCP when startup profile application fails", async () => {
		using tempDir = TempDir.createSync("@jwc-main-mcp-startup-profile-");
		let disposes = 0;
		let mcpDisconnects = 0;
		let quits = 0;
		const manager = fakeManager(() => {
			mcpDisconnects++;
		});
		MCPManager.setInstance(manager);
		const { runRootCommand } = await import("../src/main");

		await runRootCommand(args("json"), [], {
			discoverAuthStorage: () => authStorageFor(tempDir.path()),
			settings: Settings.isolated({ "marketplace.autoUpdate": "off" }),
			buildSessionOptions: async () => ({ options: {} as CreateAgentSessionOptions }),
			discoverAndLoadMCPTools: async () => loadResult(manager),
			createAgentSession: async () =>
				fakeSessionResult({
					manager,
					model: fakeModel(),
					onDispose: () => {
						disposes++;
					},
				}),
			applyStartupModelProfiles: async () => {
				throw new Error("profile failed");
			},
			postmortemQuit: async () => {
				quits++;
			},
		});

		expect(disposes).toBe(1);
		expect(mcpDisconnects).toBe(1);
		expect(MCPManager.instance()).toBeUndefined();
		expect(quits).toBe(1);
	});

	it("disposes a created session and disconnects MCP on the non-interactive no-model exit path", async () => {
		using tempDir = TempDir.createSync("@jwc-main-mcp-no-model-");
		let disposes = 0;
		let mcpDisconnects = 0;
		let quits = 0;
		const manager = fakeManager(() => {
			mcpDisconnects++;
		});
		MCPManager.setInstance(manager);
		const { runRootCommand } = await import("../src/main");

		await runRootCommand(args("json"), [], {
			discoverAuthStorage: () => authStorageFor(tempDir.path()),
			settings: Settings.isolated({ "marketplace.autoUpdate": "off" }),
			buildSessionOptions: async () => ({ options: {} as CreateAgentSessionOptions }),
			discoverAndLoadMCPTools: async () => loadResult(manager),
			createAgentSession: async () =>
				fakeSessionResult({
					manager,
					onDispose: () => {
						disposes++;
					},
				}),
			applyStartupModelProfiles: async () => {},
			postmortemQuit: async () => {
				quits++;
			},
		});

		expect(disposes).toBe(1);
		expect(mcpDisconnects).toBe(1);
		expect(MCPManager.instance()).toBeUndefined();
		expect(quits).toBe(1);
	});

	it("does not dispose a print-mode session twice", async () => {
		using tempDir = TempDir.createSync("@jwc-main-mcp-print-");
		let disposes = 0;
		let quits = 0;
		const { runRootCommand } = await import("../src/main");

		await runRootCommand(args("text"), [], {
			discoverAuthStorage: () => authStorageFor(tempDir.path()),
			settings: Settings.isolated({ "marketplace.autoUpdate": "off" }),
			buildSessionOptions: async () => ({ options: {} as CreateAgentSessionOptions }),
			createAgentSession: async () =>
				fakeSessionResult({
					model: fakeModel(),
					onDispose: () => {
						disposes++;
					},
				}),
			applyStartupModelProfiles: async () => {},
			runPrintMode: async session => {
				await session.dispose();
			},
			postmortemQuit: async () => {
				quits++;
			},
		});

		expect(disposes).toBe(1);
		expect(quits).toBe(1);
	});

	it("disposes a created session when bridge startup throws", async () => {
		using tempDir = TempDir.createSync("@jwc-main-mcp-bridge-");
		let disposes = 0;
		const { runRootCommand } = await import("../src/main");

		await expect(
			runRootCommand(args("bridge"), [], {
				discoverAuthStorage: () => authStorageFor(tempDir.path()),
				settings: Settings.isolated({ "marketplace.autoUpdate": "off" }),
				buildSessionOptions: async () => ({ options: {} as CreateAgentSessionOptions }),
				createAgentSession: async () =>
					fakeSessionResult({
						model: fakeModel(),
						onDispose: () => {
							disposes++;
						},
					}),
				applyStartupModelProfiles: async () => {},
				runBridgeMode: async () => {
					throw new Error("bridge failed");
				},
			}),
		).rejects.toThrow("bridge failed");

		expect(disposes).toBe(1);
	});
	it("preserves session creation errors when CLI-owned MCP cleanup fails", async () => {
		using tempDir = TempDir.createSync("@jwc-main-mcp-cleanup-error-");
		const manager = {
			disconnectAll: async () => {
				throw new Error("disconnect failed");
			},
		} as unknown as MCPManager;
		MCPManager.setInstance(manager);
		const { runRootCommand } = await import("../src/main");

		await expect(
			runRootCommand(args("json"), [], {
				discoverAuthStorage: () => authStorageFor(tempDir.path()),
				settings: Settings.isolated({ "marketplace.autoUpdate": "off" }),
				buildSessionOptions: async () => ({ options: {} as CreateAgentSessionOptions }),
				discoverAndLoadMCPTools: async () => loadResult(manager),
				createAgentSession: async () => {
					throw new Error("original create failure");
				},
			}),
		).rejects.toThrow("original create failure");

		expect(MCPManager.instance()).toBeUndefined();
	});

	it("disposes before the interactive PI_TIMING=x early exit", async () => {
		using tempDir = TempDir.createSync("@jwc-main-mcp-timing-exit-");
		let disposes = 0;
		let quits = 0;
		const previousTiming = Bun.env.PI_TIMING;
		Bun.env.PI_TIMING = "x";
		const { runRootCommand } = await import("../src/main");

		try {
			await runRootCommand({ ...args("json"), mode: undefined, continue: true }, [], {
				discoverAuthStorage: () => authStorageFor(tempDir.path()),
				settings: Settings.isolated({ "marketplace.autoUpdate": "off" }),
				buildSessionOptions: async () => ({ options: {} as CreateAgentSessionOptions }),
				createAgentSession: async () =>
					fakeSessionResult({
						model: fakeModel(),
						onDispose: () => {
							disposes++;
						},
					}),
				applyStartupModelProfiles: async () => {},
				postmortemQuit: async () => {
					quits++;
				},
			});
		} finally {
			if (previousTiming === undefined) {
				delete Bun.env.PI_TIMING;
			} else {
				Bun.env.PI_TIMING = previousTiming;
			}
		}

		expect(disposes).toBe(1);
		expect(quits).toBe(1);
	});
});
