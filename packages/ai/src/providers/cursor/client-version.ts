/**
 * The Cursor client version reported to api2.cursor.sh.
 *
 * The backend gates on this version, so the same value must be used by both
 * the agent run path (providers/cursor.ts) and model discovery
 * (utils/discovery/cursor.ts). Keep it in one place so drift cannot split
 * the integration when one build is deprecated.
 */
export const CURSOR_CLIENT_VERSION = "cli-2026.02.13-41ac335";
