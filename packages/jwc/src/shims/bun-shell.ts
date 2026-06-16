/**
 * Bun `$` shell tagged-template Node adapter (100.07, used by the "bun"
 * module alias). Surface census (260613): $`cmd ${value}` with chained
 * .quiet().nothrow().cwd().env(), awaited directly or via .text()/.json(),
 * output { stdout, stderr, exitCode, text(), json() }.
 *
 * Interpolated values are single-quote shell-escaped (Bun escapes them too);
 * execution goes through /bin/sh -c.
 */
import { spawn } from "node:child_process";

export interface ShellOutput {
	stdout: Buffer;
	stderr: Buffer;
	exitCode: number;
	text(): string;
	json(): unknown;
}

export class ShellError extends Error {
	constructor(
		message: string,
		readonly exitCode: number,
		readonly stdout: Buffer,
		readonly stderr: Buffer,
	) {
		super(message);
		this.name = "ShellError";
	}
}

function escapeValue(value: unknown): string {
	if (Array.isArray(value)) return value.map(escapeValue).join(" ");
	const text = String(value ?? "");
	return `'${text.replaceAll("'", `'\\''`)}'`;
}

class ShellPromise implements PromiseLike<ShellOutput> {
	#command: string;
	#cwd?: string;
	#env?: NodeJS.ProcessEnv;
	#nothrow = false;
	#run?: Promise<ShellOutput>;

	constructor(strings: TemplateStringsArray, values: unknown[]) {
		let command = strings[0] ?? "";
		for (let i = 0; i < values.length; i++) {
			command += escapeValue(values[i]);
			command += strings[i + 1] ?? "";
		}
		this.#command = command;
	}

	quiet(): this {
		// Output is always captured (never inherited) in this shim.
		return this;
	}

	nothrow(): this {
		this.#nothrow = true;
		return this;
	}

	throws(shouldThrow: boolean): this {
		this.#nothrow = !shouldThrow;
		return this;
	}

	cwd(dir: string): this {
		this.#cwd = dir;
		return this;
	}

	env(environment: NodeJS.ProcessEnv): this {
		this.#env = environment;
		return this;
	}

	#execute(): Promise<ShellOutput> {
		this.#run ??= new Promise<ShellOutput>((resolve, reject) => {
			const child = spawn("/bin/sh", ["-c", this.#command], {
				cwd: this.#cwd,
				env: this.#env ?? process.env,
				stdio: ["ignore", "pipe", "pipe"],
			});
			const stdout: Buffer[] = [];
			const stderr: Buffer[] = [];
			child.stdout.on("data", chunk => stdout.push(chunk as Buffer));
			child.stderr.on("data", chunk => stderr.push(chunk as Buffer));
			child.once("error", reject);
			child.once("close", code => {
				const exitCode = code ?? 1;
				const out = Buffer.concat(stdout);
				const err = Buffer.concat(stderr);
				const output: ShellOutput = {
					stdout: out,
					stderr: err,
					exitCode,
					text: () => out.toString("utf8"),
					json: () => JSON.parse(out.toString("utf8")),
				};
				if (exitCode !== 0 && !this.#nothrow) {
					reject(
						new ShellError(`Command failed with exit code ${exitCode}: ${this.#command}`, exitCode, out, err),
					);
					return;
				}
				resolve(output);
			});
		});
		return this.#run;
	}

	// biome-ignore lint/suspicious/noThenProperty: intentional thenable — Bun's `$` template is awaited directly.
	then<TResult1 = ShellOutput, TResult2 = never>(
		onfulfilled?: ((value: ShellOutput) => TResult1 | PromiseLike<TResult1>) | null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): Promise<TResult1 | TResult2> {
		return this.#execute().then(onfulfilled, onrejected);
	}

	catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null) {
		return this.#execute().catch(onrejected);
	}

	finally(onfinally?: (() => void) | null) {
		return this.#execute().finally(onfinally);
	}

	async text(): Promise<string> {
		return (await this.#execute()).text();
	}

	async json(): Promise<unknown> {
		return (await this.#execute()).json();
	}

	async arrayBuffer(): Promise<ArrayBuffer> {
		const out = (await this.#execute()).stdout;
		return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
	}
}

export function $(strings: TemplateStringsArray, ...values: unknown[]): ShellPromise {
	return new ShellPromise(strings, values);
}
