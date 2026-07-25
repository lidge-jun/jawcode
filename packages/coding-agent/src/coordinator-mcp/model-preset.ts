import * as path from "node:path";
import { getAgentDir } from "@jawcode-dev/utils";
import { type ModelProfileDefinition, mergeModelProfiles } from "../config/model-profiles";
import { ModelsConfigFile } from "../config/model-registry";

export type CoordinatorModelProfileLoader = () =>
	| Map<string, ModelProfileDefinition>
	| Promise<Map<string, ModelProfileDefinition>>;

const MAX_ECHOED_MPRESET_LENGTH = 128;

export class CoordinatorModelProfileRegistryError extends Error {
	constructor(cause?: unknown) {
		super("coordinator_model_profile_registry_error");
		this.name = "CoordinatorModelProfileRegistryError";
		if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
	}
}

/** Load the same merged built-in/custom profile registry used by `jwc --mpreset`. */
export const loadCoordinatorModelProfiles: CoordinatorModelProfileLoader = () => {
	const configFile = ModelsConfigFile.relocate(path.join(getAgentDir(), "models.yml"));
	configFile.invalidate();
	const loaded = configFile.tryLoad();
	if (loaded.status === "error") throw new CoordinatorModelProfileRegistryError(loaded.error);
	return mergeModelProfiles(loaded.value?.profiles);
};

function sortedProfileNames(profiles: ReadonlyMap<string, ModelProfileDefinition>): string[] {
	return [...profiles.keys()].sort((left, right) => left.localeCompare(right));
}

export type CoordinatorMpresetResolution =
	| { ok: true; mpreset: string | null }
	| { ok: false; reason: "unknown_model_profile"; mpreset: string; available_profiles: string[] }
	| { ok: false; reason: "model_profile_registry_error"; mpreset: string; available_profiles: string[] };

/** Resolve an MCP `mpreset` before any child process or durable turn side effect. */
export async function resolveCoordinatorMpreset(
	raw: unknown,
	loadProfiles: CoordinatorModelProfileLoader,
): Promise<CoordinatorMpresetResolution> {
	if (raw === undefined || raw === null) return { ok: true, mpreset: null };
	const requested = typeof raw === "string" ? raw.trim() : "";
	const echoed = requested.slice(0, MAX_ECHOED_MPRESET_LENGTH);
	let profiles: Map<string, ModelProfileDefinition>;
	try {
		profiles = await loadProfiles();
	} catch (error) {
		if (error instanceof CoordinatorModelProfileRegistryError) {
			return { ok: false, reason: "model_profile_registry_error", mpreset: echoed, available_profiles: [] };
		}
		throw error;
	}

	if (typeof raw !== "string" || requested.length === 0 || !profiles.has(requested)) {
		return {
			ok: false,
			reason: "unknown_model_profile",
			mpreset: echoed,
			available_profiles: sortedProfileNames(profiles),
		};
	}
	return { ok: true, mpreset: requested };
}

export type CoordinatorMpresetReuseCheck =
	| { ok: true }
	| {
			ok: false;
			reason: "mpreset_conflict";
			session_mpreset: string | null;
			requested_mpreset: string;
	  };

/** An explicit reuse request may not retrofit or replace a session's spawn-time profile. */
export function checkCoordinatorMpresetReuse(
	session: Readonly<Record<string, unknown>>,
	requestedMpreset: string | null,
): CoordinatorMpresetReuseCheck {
	if (requestedMpreset === null) return { ok: true };
	const sessionMpreset = typeof session.mpreset === "string" ? session.mpreset : null;
	if (sessionMpreset === requestedMpreset) return { ok: true };
	return {
		ok: false,
		reason: "mpreset_conflict",
		session_mpreset: sessionMpreset,
		requested_mpreset: requestedMpreset,
	};
}
