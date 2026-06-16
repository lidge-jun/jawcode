import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { native } from "../native.js";
import { categoryToTier, getAppCategory, isFullTierOverride } from "../safety/tiers.js";
import type { GrantedApp, SessionState } from "../session.js";

type ResolvedApp = {
	name: string;
	bundleId: string | null;
	installed: boolean;
};

type GrantTier = GrantedApp["tier"];

function ok(text: string, structuredContent?: Record<string, unknown>) {
	return {
		content: [{ type: "text" as const, text }],
		...(structuredContent !== undefined ? { structuredContent } : {}),
	};
}

function fail(text: string, structuredContent?: Record<string, unknown>) {
	return {
		content: [{ type: "text" as const, text }],
		isError: true,
		...(structuredContent !== undefined ? { structuredContent } : {}),
	};
}

export function registerAppTools(server: McpServer, session: SessionState) {
	server.registerTool(
		"open_application",
		{
			description: "Bring an application to the front, launching it if necessary. The app must already be granted.",
			inputSchema: z.object({
				app: z.string().describe("Display name or bundle identifier."),
			}),
		},
		async ({ app }) => {
			const resolved = (await native.appsResolve([app])) as ResolvedApp[];
			const target = resolved[0];

			if (!target?.installed || !target.bundleId) {
				return fail(`Application "${app}" is not installed.`);
			}
			if (!session.allowedApps.has(target.bundleId)) {
				return fail(`Application "${target.name}" is not in the allowed applications. Call request_access first.`);
			}

			const result = (await native.appsOpen(target.bundleId)) as { opened: string };
			return ok(
				`Opened "${result.opened}". If it isn't visible in the next screenshot, it may have opened on a different monitor — use switch_display to check.`,
			);
		},
	);

	server.registerTool(
		"request_access",
		{
			description: "Request permission to control one or more applications.",
			inputSchema: z.object({
				apps: z.array(z.string()).describe("Display names or bundle identifiers."),
				reason: z.string().describe("One-sentence task explanation."),
				clipboardRead: z.boolean().optional(),
				clipboardWrite: z.boolean().optional(),
				systemKeyCombos: z.boolean().optional(),
			}),
		},
		async ({ apps, reason, clipboardRead, clipboardWrite, systemKeyCombos }) => {
			void reason;

			const resolved = (await native.appsResolve(apps)) as ResolvedApp[];
			const grantedAt = Date.now();
			const granted: Array<{
				bundleId: string;
				displayName: string;
				grantedAt: number;
				tier: GrantTier;
			}> = [];
			const denied: Array<{ bundleId: string; reason: string }> = [];

			for (const entry of resolved) {
				if (!entry.installed || !entry.bundleId) {
					denied.push({
						bundleId: entry.bundleId ?? entry.name,
						reason: "not_installed",
					});
					continue;
				}

				const category = getAppCategory(entry.bundleId);
				const tier = categoryToTier(category);
				if (!tier) {
					denied.push({
						bundleId: entry.bundleId,
						reason: "media_blocked",
					});
					continue;
				}

				const grant = {
					bundleId: entry.bundleId,
					displayName: entry.name,
					grantedAt,
					tier,
				} satisfies GrantedApp;
				session.allowedApps.set(entry.bundleId, grant);
				granted.push(grant);
			}

			session.grantFlags.clipboardRead = session.grantFlags.clipboardRead || Boolean(clipboardRead);
			session.grantFlags.clipboardWrite = session.grantFlags.clipboardWrite || Boolean(clipboardWrite);
			session.grantFlags.systemKeyCombos = session.grantFlags.systemKeyCombos || Boolean(systemKeyCombos);

			const response = {
				granted,
				denied,
				tierGuidance: isFullTierOverride()
					? "CU_TIER_OVERRIDE=full active — all apps granted full tier (personal-use)"
					: "browser=read, terminal=click, other=full, media=blocked",
			};

			return ok(JSON.stringify(response, null, 2), response);
		},
	);

	server.registerTool(
		"list_granted_applications",
		{
			description: "List the currently granted applications plus active grant flags and coordinate mode.",
			inputSchema: z.object({}),
		},
		async () => {
			const response = {
				granted: [...session.allowedApps.values()],
				grantFlags: session.grantFlags,
				coordinateMode: session.coordinateMode,
			};
			return ok(JSON.stringify(response, null, 2), response);
		},
	);
}
