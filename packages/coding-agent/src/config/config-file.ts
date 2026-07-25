import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir, isEnoent, logger } from "@jawcode-dev/utils";
import { JSONC, YAML } from "bun";
import type { ZodType } from "zod/v4";

const CONFIG_FILE_MODE = 0o600;

function temporaryPath(filePath: string): string {
	return path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`);
}

function fsyncDirectory(directory: string): void {
	let fd: number | undefined;
	try {
		fd = fs.openSync(directory, "r");
		fs.fsyncSync(fd);
	} catch {
		// Directory fsync is not supported on every platform/filesystem.
	} finally {
		if (fd !== undefined) fs.closeSync(fd);
	}
}

function writeDurableFile(filePath: string, content: string): void {
	const tempPath = temporaryPath(filePath);
	let fd: number | undefined;
	try {
		fd = fs.openSync(tempPath, "wx", CONFIG_FILE_MODE);
		fs.writeFileSync(fd, content, "utf-8");
		fs.fsyncSync(fd);
		fs.closeSync(fd);
		fd = undefined;
		fs.renameSync(tempPath, filePath);
		fsyncDirectory(path.dirname(filePath));
	} catch (error) {
		if (fd !== undefined) fs.closeSync(fd);
		fs.rmSync(tempPath, { force: true });
		throw error;
	}
}

/**
 * Atomically replace a config file while retaining the previous bytes as
 * `<file>.bak`. Temp and backup files stay beside the target so rename cannot
 * cross filesystem boundaries. All generated files are owner-readable only.
 */
export function writeConfigFileAtomic(filePath: string, content: string): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
	if (fs.existsSync(filePath)) {
		writeDurableFile(`${filePath}.bak`, fs.readFileSync(filePath, "utf-8"));
	}
	writeDurableFile(filePath, content);
}

/** Minimal subset of the AJV ConfigSchemaError shape this module actually relies on. */
interface ConfigSchemaError {
	instancePath: string;
	message: string | undefined;
}

function migrateJsonToYml(jsonPath: string, ymlPath: string) {
	try {
		if (fs.existsSync(ymlPath)) return;
		if (!fs.existsSync(jsonPath)) return;

		const content = fs.readFileSync(jsonPath, "utf-8");
		const parsed = JSON.parse(content);
		if (!parsed) {
			logger.warn("migrateJsonToYml: invalid json structure", { path: jsonPath });
			return;
		}
		writeConfigFileAtomic(ymlPath, YAML.stringify(parsed, null, 2));
	} catch (error) {
		logger.warn("migrateJsonToYml: migration failed", { error: String(error) });
	}
}

export interface IConfigFile<T> {
	readonly id: string;
	readonly schema: ZodType<T>;
	path?(): string;
	load(): T | null;
	write?(value: T): void;
	invalidate?(): void;
}

export class ConfigError extends Error {
	readonly #message: string;
	constructor(
		public readonly id: string,
		public readonly schemaErrors: ConfigSchemaError[] | null | undefined,
		public readonly other?: { err: unknown; stage: string },
	) {
		let messages: string[] | undefined;
		let cause: Error | undefined;
		let klass: string;

		if (schemaErrors) {
			klass = "Schema";
			messages = schemaErrors.map(e => `${e.instancePath || "root"}: ${e.message}`);
		} else if (other) {
			klass = other.stage;
			if (other.err instanceof Error) {
				messages = [other.err.message];
				cause = other.err;
			} else {
				messages = [String(other.err)];
			}
		} else {
			klass = "Unknown";
		}

		const title = `Failed to load config file ${id}, ${klass} error:`;
		let message: string;
		switch (messages?.length ?? 0) {
			case 0:
				message = title.slice(0, -1);
				break;
			case 1:
				message = `${title} ${messages![0]}`;
				break;
			default:
				message = `${title}\n${messages!.map(m => `  - ${m}`).join("\n")}`;
		}

		super(message, { cause });
		this.name = "LoadError";
		this.#message = message;
	}

	get message(): string {
		return this.#message;
	}

	toString(): string {
		return this.message;
	}
}

export type LoadStatus = "ok" | "error" | "not-found";

export type LoadResult<T> =
	| { value?: null; error: ConfigError; status: "error" }
	| { value: T; error?: undefined; status: "ok" }
	| { value?: null; error?: unknown; status: "not-found" };

export class ConfigFile<T> implements IConfigFile<T> {
	readonly #basePath: string;
	#cache?: LoadResult<T>;
	#auxValidate?: (value: T) => void;

	constructor(
		readonly id: string,
		readonly schema: ZodType<T>,
		configPath: string = path.join(getAgentDir(), `${id}.yml`),
	) {
		this.#basePath = configPath;
		if (configPath.endsWith(".yml")) {
			const jsonPath = `${configPath.slice(0, -4)}.json`;
			migrateJsonToYml(jsonPath, configPath);
		} else if (configPath.endsWith(".yaml")) {
			const jsonPath = `${configPath.slice(0, -5)}.json`;
			migrateJsonToYml(jsonPath, configPath);
		} else if (configPath.endsWith(".json") || configPath.endsWith(".jsonc")) {
			// JSON configs are still supported without migration.
		} else {
			throw new Error(`Invalid config file path: ${configPath}`);
		}
	}

	relocate(configPath?: string): ConfigFile<T> {
		if (!configPath || configPath === this.#basePath) return this;
		const result = new ConfigFile<T>(this.id, this.schema, configPath);
		result.#auxValidate = this.#auxValidate;
		return result;
	}

	getMtimeMs(): number | null {
		try {
			return fs.statSync(this.path()).mtimeMs;
		} catch (err) {
			if (isEnoent(err)) return null;
			throw err;
		}
	}

	withValidation(name: string, validate: (value: T) => void): this {
		const prev = this.#auxValidate;
		this.#auxValidate = (value: T) => {
			prev?.(value);
			try {
				validate(value);
			} catch (error) {
				throw new ConfigError(this.id, undefined, { err: error, stage: `Validate(${name})` });
			}
		};
		return this;
	}

	createDefault(): T {
		const parsed = this.schema.safeParse({});
		if (parsed.success) return parsed.data;
		const fallback = this.schema.safeParse(undefined);
		if (fallback.success) return fallback.data;
		throw new ConfigError(this.id, undefined, {
			err: new Error("Schema produced no default value"),
			stage: "createDefault",
		});
	}

	#storeCache(result: LoadResult<T>): LoadResult<T> {
		this.#cache = result;
		return result;
	}

	#parse(content: string): T {
		let parsed: unknown;
		if (this.#basePath.endsWith(".json") || this.#basePath.endsWith(".jsonc")) {
			parsed = JSONC.parse(content);
		} else if (this.#basePath.endsWith(".yml") || this.#basePath.endsWith(".yaml")) {
			parsed = YAML.parse(content);
		} else {
			throw new Error(`Invalid config file path: ${this.#basePath}`);
		}

		const checked = this.schema.safeParse(parsed);
		if (!checked.success) {
			const schemaErrors: ConfigSchemaError[] = [];
			for (const issue of checked.error.issues) {
				const instancePath = issue.path.length === 0 ? "" : `/${issue.path.map(String).join("/")}`;
				schemaErrors.push({ instancePath, message: issue.message });
				if (schemaErrors.length >= 50) break;
			}
			throw new ConfigError(this.id, schemaErrors);
		}

		try {
			this.#auxValidate?.(checked.data);
		} catch (error) {
			throw error instanceof ConfigError
				? error
				: new ConfigError(this.id, undefined, { err: error, stage: "AuxValidate" });
		}
		return checked.data;
	}

	#asConfigError(error: unknown): ConfigError {
		return error instanceof ConfigError
			? error
			: new ConfigError(this.id, undefined, { err: error, stage: "Unexpected" });
	}

	#recoverFromBackup(primaryContent: string, primaryError: ConfigError): LoadResult<T> {
		const backupPath = `${this.path()}.bak`;
		try {
			const backupContent = fs.readFileSync(backupPath, "utf-8");
			const value = this.#parse(backupContent.trim());
			const quarantinePath = `${this.path()}.corrupt-${Date.now()}`;
			try {
				writeDurableFile(quarantinePath, primaryContent);
			} catch (error) {
				logger.warn("Failed to quarantine malformed config file", {
					path: this.path(),
					error: String(error),
				});
			}
			writeDurableFile(this.path(), backupContent);
			logger.warn("Recovered malformed config file from backup", {
				path: this.path(),
				backupPath,
				quarantinePath,
			});
			return { value, status: "ok" };
		} catch (backupError) {
			if (!isEnoent(backupError)) {
				logger.warn("Config backup recovery failed", {
					path: this.path(),
					backupPath,
					error: String(backupError),
				});
			}
			return { error: primaryError, status: "error" };
		}
	}

	tryLoad(): LoadResult<T> {
		if (this.#cache) return this.#cache;

		try {
			const content = fs.readFileSync(this.path(), "utf-8");
			try {
				return this.#storeCache({ value: this.#parse(content.trim()), status: "ok" });
			} catch (error) {
				const wrapped = this.#asConfigError(error);
				logger.warn("Failed to parse config file", { path: this.path(), error: wrapped });
				return this.#storeCache(this.#recoverFromBackup(content, wrapped));
			}
		} catch (error) {
			if (isEnoent(error)) {
				return this.#storeCache({ status: "not-found" });
			}
			logger.warn("Failed to parse config file", { path: this.path(), error });
			return this.#storeCache({
				error: new ConfigError(this.id, undefined, { err: error, stage: "Unexpected" }),
				status: "error",
			});
		}
	}

	load(): T | null {
		return this.tryLoad().value ?? null;
	}

	loadOrDefault(): T {
		return this.tryLoad().value ?? this.createDefault();
	}

	write(value: T): void {
		const checked = this.schema.safeParse(value);
		if (!checked.success) {
			const schemaErrors = checked.error.issues.slice(0, 50).map(issue => ({
				instancePath: issue.path.length === 0 ? "" : `/${issue.path.map(String).join("/")}`,
				message: issue.message,
			}));
			throw new ConfigError(this.id, schemaErrors);
		}
		this.#auxValidate?.(checked.data);
		const content =
			this.#basePath.endsWith(".json") || this.#basePath.endsWith(".jsonc")
				? `${JSON.stringify(checked.data, null, 2)}\n`
				: YAML.stringify(checked.data, null, 2);
		writeConfigFileAtomic(this.path(), content);
		this.#storeCache({ value: checked.data, status: "ok" });
	}

	path(): string {
		return this.#basePath;
	}

	invalidate() {
		this.#cache = undefined;
	}
}
