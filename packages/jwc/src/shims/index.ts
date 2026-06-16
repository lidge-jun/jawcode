/**
 * Global Bun shim install entry (100.02). Injected by esbuild ahead of the
 * Node bundle so `globalThis.Bun` exists before any upstream module body
 * runs. On the Bun runtime this file is a no-op — native Bun is never
 * overridden (100 MOC Q4: dual runtime stays).
 */
import { buildNodeBunShim } from "./bun-object";

const nativeBun = (globalThis as { Bun?: unknown }).Bun;

if (!nativeBun) {
	Object.defineProperty(globalThis, "Bun", {
		value: buildNodeBunShim(),
		configurable: true,
		writable: false,
	});
}
