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

export type ModulePreferenceState = "inherit" | "enabled" | "disabled";

export const MODULE_PREFERENCE_STATE_LABELS: Record<ModulePreferenceState, string> = {
  inherit: "Use channel default",
  enabled: "Enabled",
  disabled: "Disabled",
};

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

export function storedModulePreferenceToState(
  storedPreference: NotificationPreferenceItem | undefined,
): ModulePreferenceState {
  if (!storedPreference) {
    return "inherit";
  }
  return storedPreference.is_enabled ? "enabled" : "disabled";
}

export function modulePreferenceStateToIsEnabled(
  state: ModulePreferenceState,
): boolean | null {
  if (state === "inherit") {
    return null;
  }
  return state === "enabled";
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

export function resolveChannelDefaultValue({
  channel,
  defaults,
  storedPreferences,
}: {
  channel: NotificationChannel;
  defaults: NotificationPreferencesResponse["defaults"];
  storedPreferences: NotificationPreferenceItem[];
}): boolean {
  const defaultPreference = indexStoredPreferences(storedPreferences).get(
    buildPreferenceKey("", channel),
  );
  if (defaultPreference) {
    return defaultPreference.is_enabled;
  }
  return defaults[channel];
}

export function buildChannelDefaultFormState(
  response: NotificationPreferencesResponse,
): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const channel of EXTERNAL_NOTIFICATION_CHANNELS) {
    state[buildPreferenceKey("", channel)] = resolveChannelDefaultValue({
      channel,
      defaults: response.defaults,
      storedPreferences: response.preferences,
    });
  }
  return state;
}

export function buildModuleFormState(
  response: NotificationPreferencesResponse,
): Record<string, ModulePreferenceState> {
  const indexed = indexStoredPreferences(response.preferences);
  const state: Record<string, ModulePreferenceState> = {};

  for (const sourceModule of NOTIFICATION_SOURCE_MODULES) {
    for (const channel of EXTERNAL_NOTIFICATION_CHANNELS) {
      const key = buildPreferenceKey(sourceModule, channel);
      state[key] = storedModulePreferenceToState(
        indexed.get(key),
      );
    }
  }

  return state;
}

export function formatEffectivePreferenceLabel(isEnabled: boolean): string {
  return `Uses channel default: ${isEnabled ? "Enabled" : "Disabled"}`;
}

export function buildPreferenceChanges({
  channelDefaults,
  initialChannelDefaults,
  moduleStates,
  initialModuleStates,
}: {
  channelDefaults: Record<string, boolean>;
  initialChannelDefaults: Record<string, boolean>;
  moduleStates: Record<string, ModulePreferenceState>;
  initialModuleStates: Record<string, ModulePreferenceState>;
}): NotificationPreferenceUpdateItem[] {
  const changes: NotificationPreferenceUpdateItem[] = [];

  for (const [key, isEnabled] of Object.entries(channelDefaults)) {
    if (initialChannelDefaults[key] === isEnabled) {
      continue;
    }

    const [, channel] = key.split("::") as ["default", NotificationChannel];
    changes.push({
      source_module: "",
      channel,
      is_enabled: isEnabled,
    });
  }

  for (const [key, state] of Object.entries(moduleStates)) {
    if (initialModuleStates[key] === state) {
      continue;
    }

    const [sourceModule, channel] = key.split("::") as [
      NotificationSourceModule,
      NotificationChannel,
    ];
    const initialState = initialModuleStates[key];

    if (state === "inherit") {
      if (initialState === "inherit") {
        continue;
      }
      changes.push({
        source_module: sourceModule,
        channel,
        is_enabled: null,
      });
      continue;
    }

    changes.push({
      source_module: sourceModule,
      channel,
      is_enabled: state === "enabled",
    });
  }

  return changes;
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

export function buildFormStateFromResponse(
  response: NotificationPreferencesResponse,
): {
  channelDefaults: Record<string, boolean>;
  moduleStates: Record<string, ModulePreferenceState>;
} {
  return {
    channelDefaults: buildChannelDefaultFormState(response),
    moduleStates: buildModuleFormState(response),
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
