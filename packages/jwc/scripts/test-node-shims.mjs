/**
 * Node-runtime shim checks (100.05). better-sqlite3 cannot load under Bun
 * (oven-sh/bun#4290), so the bun:sqlite adapter surface is asserted here
 * under real Node — the same runtime the dist-node bundle targets.
 *
 * Usage: node scripts/test-node-shims.mjs   (cwd: packages/jwc)
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { build } from "esbuild";

// Bundle inside the package so the external better-sqlite3 import resolves
// against the workspace node_modules (tmpdir has no resolution root).
const outfile = path.join(process.cwd(), "dist-node", `_sqlite-shim-test-${process.pid}.mjs`);
await build({
	entryPoints: ["src/shims/bun-sqlite.ts"],
	outfile,
	bundle: true,
	platform: "node",
	format: "esm",
	external: ["better-sqlite3"],
});
const { Database } = await import(outfile);

const dbPath = path.join(tmpdir(), `jwc-sqlite-shim-${process.pid}.db`);
const db = new Database(dbPath);
try {
	db.exec("CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT)");
	db.run("INSERT INTO kv (k, v) VALUES (?, ?)", "a", "1");
	db.prepare("INSERT INTO kv (k, v) VALUES ($k, $v)").run({ $k: "b", $v: "2" });
	assert.equal(db.prepare("SELECT v FROM kv WHERE k = ?").get("a")?.v, "1");
	assert.deepEqual(db.query("SELECT v FROM kv WHERE k = ?").get("b"), { v: "2" });
	assert.deepEqual(db.prepare("SELECT k FROM kv ORDER BY k").all(), [{ k: "a" }, { k: "b" }]);
	assert.equal(db.prepare("SELECT v FROM kv WHERE k = ?").get("missing"), null);
	const insertMany = db.transaction(rows => {
		for (const [k, v] of rows) db.run("INSERT INTO kv (k, v) VALUES (?, ?)", k, v);
		return rows.length;
	});
	assert.equal(
		insertMany([
			["c", "3"],
			["d", "4"],
		]),
		2,
	);
	assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kv").get()?.n, 4);
	assert.deepEqual(db.prepare("SELECT k FROM kv ORDER BY k").values(), [["a"], ["b"], ["c"], ["d"]]);
	console.log("[test-node-shims] bun:sqlite adapter surface OK");

	// B-1 regression: create:false must throw on a missing file (the write/read
	// tools rely on this as a "DB not found" guard), not silently create it.
	const missing = path.join(tmpdir(), `jwc-sqlite-absent-${process.pid}.db`);
	rmSync(missing, { force: true });
	assert.throws(() => new Database(missing, { create: false }), /unable to open|cannot open|SQLITE_CANTOPEN/i);
	assert.ok(!existsSync(missing), "create:false must not create the file");
	console.log("[test-node-shims] create:false guard OK");
} finally {
	db.close();
	rmSync(dbPath, { force: true });
	rmSync(outfile, { force: true });
}

// ── Archive shim: tar mtime round-trip (B-2) + path-traversal sanitize (B-3) ─
{
	const archiveOut = path.join(process.cwd(), "dist-node", `_archive-shim-test-${process.pid}.mjs`);
	await build({
		entryPoints: ["src/shims/bun-archive.ts"],
		outfile: archiveOut,
		bundle: true,
		platform: "node",
		format: "esm",
	});
	const { BunArchive } = await import(archiveOut);
	const tmpTar = path.join(tmpdir(), `jwc-archive-${process.pid}.tar`);
	try {
		await BunArchive.write(tmpTar, { "hello.txt": "hi there" });
		const bytes = readFileSync(tmpTar);
		const before = Date.now();
		const files = await new BunArchive(bytes).files();
		const entry = files.get("hello.txt");
		assert.ok(entry, "round-trip entry missing");
		assert.equal(await entry.text(), "hi there");
		// mtime came from the tar header (written near `before`), not a fresh
		// Date.now() at read time — both land in the same second window, but the
		// point is it is a real header value, not 0 and not drifting.
		assert.ok(entry.lastModified > 0 && entry.lastModified <= before + 2000, "mtime not from tar header");
		console.log("[test-node-shims] archive mtime round-trip OK");

		// round-4 SQ-1: >100-byte entry names must round-trip (ustar prefix or
		// GNU longname), not throw — read-then-rewrite of long-path tars.
		const longName = `${"d".repeat(80)}/${"f".repeat(90)}.txt`; // 171 bytes, splittable
		const gnuName = `${"x".repeat(140)}.txt`; // 144 bytes, single segment → GNU longname
		const longTar = path.join(tmpdir(), `jwc-longtar-${process.pid}.tar`);
		try {
			await BunArchive.write(longTar, { [longName]: "a", [gnuName]: "b" });
			const back = await new BunArchive(readFileSync(longTar)).files();
			assert.ok(back.get(longName), `ustar-prefix long name lost: have ${[...back.keys()]}`);
			assert.ok(back.get(gnuName), `GNU longname lost: have ${[...back.keys()]}`);
			assert.equal(await back.get(longName).text(), "a");
			assert.equal(await back.get(gnuName).text(), "b");
			console.log("[test-node-shims] archive long-name round-trip OK");
		} finally {
			rmSync(longTar, { force: true });
		}

		// B-3: a traversal entry name must be sanitized in the returned Map keys.
		const malicious = buildEvilTar();
		const evilFiles = await new BunArchive(malicious).files();
		for (const key of evilFiles.keys()) {
			assert.ok(!key.split("/").includes(".."), `traversal key leaked: ${key}`);
		}
		console.log("[test-node-shims] archive path-traversal sanitize OK");

		// round-6: write must preserve File.lastModified as tar mtime (no reset
		// to now) so multi-entry edits keep mtimes and identical inputs are
		// deterministic.
		const mtimeMs = 1_700_000_000_000;
		const preserved = await BunArchive.write(path.join(tmpdir(), `jwc-mt-${process.pid}.tar`), {
			"keep.txt": new File(["data"], "keep.txt", { lastModified: mtimeMs }),
		});
		void preserved;
		const mtTar = path.join(tmpdir(), `jwc-mt2-${process.pid}.tar`);
		try {
			await BunArchive.write(mtTar, { "keep.txt": new File(["data"], "keep.txt", { lastModified: mtimeMs }) });
			const roundtrip = await new BunArchive(readFileSync(mtTar)).files();
			assert.equal(roundtrip.get("keep.txt").lastModified, Math.floor(mtimeMs / 1000) * 1000, "write dropped File mtime");
			// determinism: same input → same bytes.
			const a = readFileSync(mtTar);
			await BunArchive.write(mtTar, { "keep.txt": new File(["data"], "keep.txt", { lastModified: mtimeMs }) });
			assert.deepEqual([...readFileSync(mtTar)], [...a], "tar write not deterministic");
			console.log("[test-node-shims] archive write mtime preserve + determinism OK");
		} finally {
			rmSync(mtTar, { force: true });
		}

		// round-5 SQ-1: a valid tar whose first entry name starts with "PK"
		// (PKG-INFO) must NOT be misrouted to unzip and must round-trip.
		const pkTar = path.join(tmpdir(), `jwc-pktar-${process.pid}.tar`);
		try {
			await BunArchive.write(pkTar, { "PKG-INFO": "Metadata-Version: 2.1" });
			const pkBytes = readFileSync(pkTar);
			assert.equal(pkBytes[0], 0x50, "first entry should start with P");
			assert.equal(pkBytes[1], 0x4b, "first entry should start with K");
			const pkFiles = await new BunArchive(pkBytes).files();
			assert.equal(await pkFiles.get("PKG-INFO").text(), "Metadata-Version: 2.1", "PK-prefixed tar misrouted to unzip");
			console.log("[test-node-shims] archive PK-prefixed tar not misrouted OK");
		} finally {
			rmSync(pkTar, { force: true });
		}
	} finally {
		rmSync(tmpTar, { force: true });
		rmSync(archiveOut, { force: true });
	}
}

// ── Round-2 audit regressions (SQ-1 write, sqlite params/columns, file slice,
//    spawnSync stdio, serve tls, glob absolute) ──────────────────────────────
{
	const bundleOut = path.join(process.cwd(), "dist-node", `_round2-shim-test-${process.pid}.mjs`);
	const barrel = path.join(process.cwd(), "dist-node", `_round2-barrel-${process.pid}.ts`);
	writeFileSync(
		barrel,
		[
			'export { bunWrite } from "../src/shims/bun-write";',
			'export { bunFile } from "../src/shims/bun-file";',
			'export { Database } from "../src/shims/bun-sqlite";',
			'export { BunGlob } from "../src/shims/bun-glob";',
			'export { bunSpawn, bunSpawnSync } from "../src/shims/bun-spawn";',
			'export { buildNodeBunShim } from "../src/shims/bun-object";',
		].join("\n"),
	);
	await build({
		entryPoints: [barrel],
		outfile: bundleOut,
		bundle: true,
		platform: "node",
		format: "esm",
		external: ["better-sqlite3"],
	});
	rmSync(barrel, { force: true });
	const mod = await import(bundleOut);

	// SQ-1: Bun.write(dest, Response) must write RAW bytes, not UTF-8 text.
	{
		const binary = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x80, 0x00, 0x1f, 0x8b]);
		const dest = path.join(tmpdir(), `jwc-bin-${process.pid}.bin`);
		try {
			await mod.bunWrite(dest, new Response(binary));
			const written = new Uint8Array(readFileSync(dest));
			assert.deepEqual([...written], [...binary], "Response body corrupted (not raw bytes)");
			console.log("[test-node-shims] write(Response) binary fidelity OK");
		} finally {
			rmSync(dest, { force: true });
		}
	}

	// file slice: .slice(0,N).bytes() reads only the window.
	{
		const src = path.join(tmpdir(), `jwc-slice-${process.pid}.bin`);
		try {
			writeFileSync(src, Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
			const head = await mod.bunFile(src).slice(0, 4).bytes();
			assert.deepEqual([...head], [1, 2, 3, 4], "slice window wrong");
			console.log("[test-node-shims] file.slice(0,N).bytes() OK");
		} finally {
			rmSync(src, { force: true });
		}
	}

	// sqlite paramsCount + columnNames.
	{
		const db = new mod.Database(":memory:");
		try {
			db.exec("CREATE TABLE t (a, b)");
			db.run("INSERT INTO t (a,b) VALUES (1,2)");
			assert.equal(db.prepare("SELECT * FROM t LIMIT ? OFFSET ?").paramsCount, 2, "paramsCount ? count");
			assert.equal(db.prepare("SELECT * FROM t WHERE a=:x AND b=:x").paramsCount, 1, "paramsCount distinct named");
			assert.equal(db.prepare("SELECT * FROM t").paramsCount, 0, "paramsCount zero");
			assert.equal(db.prepare("SELECT a, b FROM t WHERE a='?notaparam'").paramsCount, 0, "paramsCount ignores string literal");
			assert.deepEqual([...db.prepare("SELECT a, b FROM t").columnNames], ["a", "b"], "columnNames");
			assert.deepEqual([...db.prepare("INSERT INTO t (a,b) VALUES (3,4)").columnNames], [], "columnNames non-returning");
			console.log("[test-node-shims] sqlite paramsCount/columnNames OK");

			// round-3 SQ-1: array-form positional bindings (db.run(sql, [a,b])).
			db.run("INSERT INTO t (a,b) VALUES (?, ?)", [10, 20]);
			assert.deepEqual(db.prepare("SELECT a,b FROM t WHERE a=?").all([10]), [{ a: 10, b: 20 }], "array positional bind");
			console.log("[test-node-shims] sqlite array positional binding OK");
		} finally {
			db.close();
		}
	}

	// glob absolute pattern.
	{
		const dir = mkdtempSync(path.join(tmpdir(), "jwc-glob-"));
		try {
			writeFileSync(path.join(dir, "sub-abc.vtt"), "x");
			writeFileSync(path.join(dir, "other.txt"), "y");
			const hits = [];
			for await (const hit of new mod.BunGlob(`${dir}/sub-*.vtt`).scan({ absolute: true })) hits.push(hit);
			assert.deepEqual(hits, [path.join(dir, "sub-abc.vtt")], "absolute glob match");
			console.log("[test-node-shims] glob absolute pattern OK");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	}

	rmSync(bundleOut, { force: true });
}

// spawnSync stdio: an explicit "pipe" must capture (not inherit/ignore).
{
	const spawnOut = path.join(process.cwd(), "dist-node", `_spawn-shim-test-${process.pid}.mjs`);
	await build({
		entryPoints: ["src/shims/bun-spawn.ts"],
		outfile: spawnOut,
		bundle: true,
		platform: "node",
		format: "esm",
	});
	const { bunSpawn, bunSpawnSync } = await import(spawnOut);
	const r = bunSpawnSync(["echo", "captured"], { stdout: "pipe" });
	assert.ok(r.stdout && new TextDecoder().decode(r.stdout).includes("captured"), "spawnSync stdout pipe not captured");
	assert.equal(r.exitCode, 0);
	console.log("[test-node-shims] spawnSync stdio mapping OK");

	// round-3 SQ-1 proc: spawnSync stdout must .toString() as UTF-8 text
	// (Buffer), not a comma-separated byte list.
	const t = bunSpawnSync(["printf", "main"], { stdout: "pipe" });
	assert.equal(t.stdout.toString().trim(), "main", "spawnSync stdout .toString() not UTF-8");
	console.log("[test-node-shims] spawnSync Buffer .toString() OK");

	// round-3 SQ-2 proc: raw stdin data must be fed to the child (git commit -F -).
	const cat = bunSpawn(["cat"], { stdin: new TextEncoder().encode("piped-input"), stdout: "pipe" });
	const out = await new Response(cat.stdout).text();
	await cat.exited;
	assert.equal(out.trim(), "piped-input", "spawn raw stdin bytes not delivered");
	console.log("[test-node-shims] spawn raw stdin bytes OK");

	rmSync(spawnOut, { force: true });
}

// round-3 SQ-1 data: globalThis Bun shim must expose Glob (new Bun.Glob()).
{
	const shimOut = path.join(process.cwd(), "dist-node", `_shimobj-test-${process.pid}.mjs`);
	await build({
		entryPoints: ["src/shims/bun-object.ts"],
		outfile: shimOut,
		bundle: true,
		platform: "node",
		format: "esm",
		external: ["better-sqlite3", "json5", "strip-ansi"],
	});
	const { buildNodeBunShim } = await import(shimOut);
	const shim = buildNodeBunShim();
	assert.equal(typeof shim.Glob, "function", "Bun.Glob missing from global shim");
	assert.ok(new shim.Glob("*.txt").match("a.txt"), "Bun.Glob not usable");
	console.log("[test-node-shims] Bun.Glob global shim OK");

	// round-5 SQ-2 build: Bun.sha(text,"hex") must exist (harmony-leak audit).
	assert.equal(typeof shim.sha, "function", "Bun.sha missing from global shim");
	assert.equal(
		shim.sha("abc", "hex"),
		"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		"Bun.sha hex digest wrong",
	);
	console.log("[test-node-shims] Bun.sha global shim OK");

	// round-5 SQ-1 build: Bun.Image must construct + read metadata from a header.
	assert.equal(typeof shim.Image, "function", "Bun.Image missing from global shim");
	// 1x1 PNG.
	const png = Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
		"base64",
	);
	const meta = await new shim.Image(png).metadata();
	assert.equal(meta.format, "png", "Bun.Image png format");
	assert.equal(meta.width, 1, "Bun.Image png width");
	assert.equal(meta.height, 1, "Bun.Image png height");
	console.log("[test-node-shims] Bun.Image metadata OK");

	// 100.14: Bun.Image transforms must actually resize+re-encode via photon.
	const png16 = makeRgbaPng(16, 16);
	const jpegOut = await new shim.Image(png16).resize(8, 8).jpeg({ quality: 80 }).bytes();
	assert.ok(jpegOut instanceof Uint8Array && jpegOut.length > 0, "jpeg encode empty");
	assert.equal(jpegOut[0], 0xff, "jpeg SOI byte 0");
	assert.equal(jpegOut[1], 0xd8, "jpeg SOI byte 1");
	const pngOut = await new shim.Image(png16).resize(8, 8).png().bytes();
	assert.equal(pngOut[0], 0x89, "png signature");
	assert.equal((await new shim.Image(pngOut).metadata()).width, 8, "resized png is 8px wide");
	const webpOut = await new shim.Image(png16).resize(8, 8).webp().bytes();
	assert.equal(String.fromCharCode(webpOut[0], webpOut[1], webpOut[2], webpOut[3]), "RIFF", "webp RIFF magic");
	console.log("[test-node-shims] Bun.Image photon resize+encode (jpeg/png/webp) OK");

	// Degenerate/undecodable input must throw (image-resize catches → original).
	await assert.rejects(() => new shim.Image(Buffer.from([1, 2, 3, 4])).resize(2, 2).png().bytes(), "garbage decode should throw");
	console.log("[test-node-shims] Bun.Image undecodable input throws (graceful) OK");

	// no-resize path (target undefined): re-encode original dims, no double-free.
	const reencoded = await new shim.Image(png16).png().bytes();
	assert.equal((await new shim.Image(reencoded).metadata()).width, 16, "no-resize path keeps original dims");
	console.log("[test-node-shims] Bun.Image no-resize re-encode OK");

	// Documented limitation: photon get_bytes_webp() ignores quality — the
	// webp() quality arg is accepted (type-compat) but produces identical bytes.
	// image-resize tolerates this (falls back to the dimension ladder).
	const webpQ40 = await new shim.Image(png16).resize(8, 8).webp({ quality: 40 }).bytes();
	const webpQ90 = await new shim.Image(png16).resize(8, 8).webp({ quality: 90 }).bytes();
	assert.equal(webpQ40.length, webpQ90.length, "webp quality is expected to be a no-op in photon");
	console.log("[test-node-shims] Bun.Image webp quality no-op (documented) OK");

	rmSync(shimOut, { force: true });
}

/** Minimal valid RGBA PNG (filter byte 0 + solid pixels) for photon round-trips. */
function makeRgbaPng(w, h) {
	const crcTable = [];
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		crcTable[n] = c >>> 0;
	}
	const crc32 = buf => {
		let c = 0xffffffff;
		for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
		return (c ^ 0xffffffff) >>> 0;
	};
	const chunk = (type, data) => {
		const tb = Buffer.from(type, "ascii");
		const len = Buffer.alloc(4);
		len.writeUInt32BE(data.length, 0);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
		return Buffer.concat([len, tb, data, crc]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // color type RGBA
	const row = Buffer.concat([Buffer.from([0]), Buffer.from(new Array(w * 4).fill(0x80))]);
	const raw = Buffer.concat(new Array(h).fill(row));
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

// serve tls: cert/key must yield an https server (not plaintext).
{
	const serveOut = path.join(process.cwd(), "dist-node", `_serve-shim-test-${process.pid}.mjs`);
	await build({
		entryPoints: ["src/shims/bun-serve.ts"],
		outfile: serveOut,
		bundle: true,
		platform: "node",
		format: "esm",
	});
	const { bunServe } = await import(serveOut);
	const { cert, key } = makeSelfSigned();
	const server = bunServe({ hostname: "127.0.0.1", port: 0, tls: { cert, key }, fetch: () => new Response("ok") });
	try {
		assert.equal(server.url.protocol, "https:", "tls server must use https");
		console.log("[test-node-shims] serve tls → https OK");
	} finally {
		server.stop();
	}

	// round-4 SQ-1 proc: request.signal must abort when the client disconnects
	// mid-stream (so handlers cancel upstream work / stop token burn).
	{
		const { request, get } = await import("node:http");
		void request;
		let captured;
		const plainServer = bunServe({
			hostname: "127.0.0.1",
			port: 0,
			fetch: req => {
				captured = req.signal;
				// Never-ending stream so we can disconnect mid-flight.
				return new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(new TextEncoder().encode("x"));
						},
					}),
				);
			},
		});
		try {
			// listen() is async — wait until the port is actually bound.
			for (let i = 0; i < 50 && plainServer.port === 0; i++) await new Promise(r => setTimeout(r, 10));
			const aborted = new Promise(resolve => {
				const poll = setInterval(() => {
					if (captured?.aborted) {
						clearInterval(poll);
						resolve(true);
					}
				}, 10);
				setTimeout(() => {
					clearInterval(poll);
					resolve(false);
				}, 3000);
			});
			const clientReq = get({ hostname: "127.0.0.1", port: plainServer.port, path: "/" }, res => {
				res.once("data", () => clientReq.destroy()); // disconnect mid-stream
			});
			clientReq.on("error", () => {});
			assert.equal(await aborted, true, "request.signal did not abort on client disconnect");
			console.log("[test-node-shims] serve request.signal aborts on disconnect OK");
		} finally {
			plainServer.stop();
		}
	}
}

function makeSelfSigned() {
	// Minimal RSA self-signed cert for the https-selection assertion.
	const dir = mkdtempSync(path.join(tmpdir(), "jwc-tls-"));
	const keyPath = path.join(dir, "k.pem");
	const certPath = path.join(dir, "c.pem");
	execFileSync(
		"openssl",
		["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=localhost"],
		{ stdio: "ignore" },
	);
	const result = { cert: readFileSync(certPath, "utf8"), key: readFileSync(keyPath, "utf8") };
	rmSync(dir, { recursive: true, force: true });
	return result;
}

/** Minimal ustar tar with a single `../../etc/passwd` file entry. */
function buildEvilTar() {
	const name = "../../etc/passwd";
	const content = Buffer.from("pwned\n");
	const header = Buffer.alloc(512);
	header.write(name, 0, "utf8");
	header.write("0000644\0", 100);
	header.write("0000000\0", 108);
	header.write("0000000\0", 116);
	header.write(`${content.length.toString(8).padStart(11, "0")}\0`, 124);
	header.write(`${Math.floor(Date.now() / 1000).toString(8).padStart(11, "0")}\0`, 136);
	header.write("        ", 148);
	header[156] = 0x30;
	header.write("ustar\0", 257);
	header.write("00", 263);
	let checksum = 0;
	for (const byte of header) checksum += byte;
	header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148);
	const body = Buffer.alloc(512);
	content.copy(body);
	return new Uint8Array(Buffer.concat([header, body, Buffer.alloc(1024)]));
}
