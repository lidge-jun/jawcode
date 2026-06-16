/**
 * Bundle-only entry (P12/063.1) — bin/jwc.js must stay out of the bundle
 * graph or the published bundle would dynamically import itself.
 */
import { version as jawcodePackageVersion } from "../package.json" with { type: "json" };

process.env.JWC_BRAND_NAME = "jwc";
process.env.JWC_PACKAGE_VERSION ??= jawcodePackageVersion;
// Internal workspace import: public package/bin/docs remain Jawcode/JWC.
await import("@gajae-code/coding-agent/cli");
