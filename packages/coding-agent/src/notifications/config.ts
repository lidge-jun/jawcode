import { $resolveEnv } from "@jawcode-dev/utils";
import type { Settings } from "../config/settings";

export type NotificationVerbosity = "lean" | "verbose";

export interface NotificationSettingsSnapshot {
	enabled: boolean;
	botToken: string | undefined;
	chatId: string | undefined;
	redact: boolean;
	verbosity: NotificationVerbosity;
	idleTimeoutMs: number;
}

export interface ResolvedNotificationConfig extends NotificationSettingsSnapshot {
	configured: boolean;
	envRequested: boolean;
	hardDisabled: boolean;
}

export interface NotificationEnvSnapshot {
	notifications: string | undefined;
	token: string | undefined;
	chatId: string | undefined;
}

export function maskToken(token: string | undefined): string | null {
	if (!token) return null;
	const prefix = token.slice(0, 4);
	return `${prefix}...(len ${token.length})`;
}

export function maskChatId(chatId: string | undefined): string | null {
	if (!chatId) return null;
	if (chatId.length <= 4) return "(set)";
	return `${chatId.slice(0, 2)}...${chatId.slice(-2)}(len ${chatId.length})`;
}

export function resolveNotificationEnv(): NotificationEnvSnapshot {
	return {
		notifications: $resolveEnv("GJC_NOTIFICATIONS")?.trim(),
		token: $resolveEnv("GJC_NOTIFICATIONS_TOKEN")?.trim() || undefined,
		chatId: $resolveEnv("GJC_NOTIFICATIONS_CHAT_ID")?.trim() || undefined,
	};
}

export function isNotificationConfigured(config: Pick<ResolvedNotificationConfig, "botToken" | "chatId">): boolean {
	return !!config.botToken && !!config.chatId;
}

export function isNotificationEnabled(config: Pick<ResolvedNotificationConfig, "enabled" | "configured">): boolean {
	return config.enabled && config.configured;
}

export function isNotificationConnectTokenAccepted(expectedToken: string, presentedToken: string | undefined): boolean {
	return presentedToken !== undefined && presentedToken.length > 0 && presentedToken === expectedToken;
}

export function getNotificationConfig(settings: Settings): ResolvedNotificationConfig {
	const env = resolveNotificationEnv();
	const hardDisabled = env.notifications === "0";
	const envRequested = env.notifications === "1";
	const botToken = env.token ?? settings.get("notifications.telegram.botToken");
	const chatId = env.chatId ?? settings.get("notifications.telegram.chatId");
	const configured = !!botToken && !!chatId;
	const settingsEnabled = settings.get("notifications.enabled");
	const enabled = !hardDisabled && configured && (envRequested || settingsEnabled);

	return {
		enabled,
		configured,
		envRequested,
		hardDisabled,
		botToken,
		chatId,
		redact: settings.get("notifications.redact"),
		verbosity: settings.get("notifications.verbosity"),
		idleTimeoutMs: settings.get("notifications.daemon.idleTimeoutMs"),
	};
}

export interface NotificationStatusJson {
	enabled: boolean;
	configured: boolean;
	botTokenMasked: string | null;
	chatIdMasked: string | null;
	redact: boolean;
	verbosity: NotificationVerbosity;
	idleTimeoutMs: number;
}

export function toNotificationStatusJson(config: ResolvedNotificationConfig): NotificationStatusJson {
	return {
		enabled: config.enabled,
		configured: config.configured,
		botTokenMasked: maskToken(config.botToken),
		chatIdMasked: maskChatId(config.chatId),
		redact: config.redact,
		verbosity: config.verbosity,
		idleTimeoutMs: config.idleTimeoutMs,
	};
}
