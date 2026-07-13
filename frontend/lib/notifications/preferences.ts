import type {
  NotificationChannel,
  NotificationPreferenceItem,
  NotificationPreferenceUpdateItem,
  NotificationPreferencesResponse,
  NotificationSourceModule,
} from "@/types/notifications";

export const NOTIFICATION_SOURCE_MODULES: NotificationSourceModule[] = [
  "fm_tickets",
  "maintenance",
  "inspection",
];

export const EXTERNAL_NOTIFICATION_CHANNELS: NotificationChannel[] = [
  "email",
  "sms",
  "push",
];

export const NOTIFICATION_SOURCE_MODULE_LABELS: Record<
  NotificationSourceModule,
  string
> = {
  fm_tickets: "FM Ticketing",
  maintenance: "Maintenance",
  inspection: "5S Inspection",
};

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: "In-app",
  email: "Email",
  sms: "SMS",
  push: "Push",
};

export const EXTERNAL_DELIVERY_AVAILABILITY_MESSAGE =
  "External delivery channels are preference-ready but are not connected yet.";

export function normalizeNotificationSourceModule(
  value: string,
): NotificationSourceModule | "" {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (
    normalized === "fm_tickets" ||
    normalized === "maintenance" ||
    normalized === "inspection"
  ) {
    return normalized;
  }
  return "";
}

export function buildPreferenceKey(
  sourceModule: string,
  channel: NotificationChannel,
): string {
  return `${sourceModule || "default"}::${channel}`;
}

export function indexStoredPreferences(
  preferences: NotificationPreferenceItem[],
): Map<string, NotificationPreferenceItem> {
  const indexed = new Map<string, NotificationPreferenceItem>();
  for (const preference of preferences) {
    indexed.set(
      buildPreferenceKey(preference.source_module, preference.channel),
      preference,
    );
  }
  return indexed;
}

export function resolveEffectivePreference({
  channel,
  sourceModule = "",
  defaults,
  storedPreferences,
}: {
  channel: NotificationChannel;
  sourceModule?: string;
  defaults: NotificationPreferencesResponse["defaults"];
  storedPreferences: NotificationPreferenceItem[];
}): boolean {
  const normalizedModule = normalizeNotificationSourceModule(sourceModule);
  const indexed = indexStoredPreferences(storedPreferences);

  if (normalizedModule) {
    const modulePreference = indexed.get(buildPreferenceKey(normalizedModule, channel));
    if (modulePreference) {
      return modulePreference.is_enabled;
    }
  }

  const defaultPreference = indexed.get(buildPreferenceKey("", channel));
  if (defaultPreference) {
    return defaultPreference.is_enabled;
  }

  return defaults[channel];
}

export function buildPreferenceUpdatePayload(
  entries: NotificationPreferenceUpdateItem[],
): { preferences: NotificationPreferenceUpdateItem[] } {
  return {
    preferences: entries.map((entry) => ({
      source_module: normalizeNotificationSourceModule(entry.source_module ?? ""),
      channel: entry.channel,
      is_enabled: entry.is_enabled,
    })),
  };
}

export function formatNotificationPreferenceError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Unable to update notification preferences right now.";
}

export function formatNotificationPreferenceSuccess(): string {
  return "Notification preferences saved.";
}
