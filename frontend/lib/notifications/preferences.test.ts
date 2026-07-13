import assert from "node:assert/strict";
import test from "node:test";

import { notificationQueryKeys } from "@/services/api/query-keys";

import {
  buildChannelDefaultFormState,
  buildFormStateFromResponse,
  buildModuleFormState,
  buildPreferenceChanges,
  buildPreferenceKey,
  buildPreferenceUpdatePayload,
  EXTERNAL_DELIVERY_AVAILABILITY_MESSAGE,
  formatEffectivePreferenceLabel,
  formatNotificationPreferenceError,
  formatNotificationPreferenceSuccess,
  normalizeNotificationSourceModule,
  resolveEffectivePreference,
  storedModulePreferenceToState,
} from "./preferences";

const platformDefaults = {
  in_app: true,
  email: false,
  sms: false,
  push: false,
} as const;

const storedPreferences = [
  {
    id: "1",
    source_module: "",
    channel: "email" as const,
    is_enabled: true,
    created_at: "2026-07-13T12:00:00.000Z",
    updated_at: "2026-07-13T12:00:00.000Z",
  },
  {
    id: "2",
    source_module: "maintenance",
    channel: "email" as const,
    is_enabled: false,
    created_at: "2026-07-13T12:00:00.000Z",
    updated_at: "2026-07-13T12:00:00.000Z",
  },
];

test("preference update payload normalizes source modules", () => {
  const payload = buildPreferenceUpdatePayload([
    {
      source_module: " Maintenance ",
      channel: "email",
      is_enabled: true,
    },
    {
      source_module: "",
      channel: "push",
      is_enabled: false,
    },
    {
      source_module: "maintenance",
      channel: "sms",
      is_enabled: null,
    },
  ]);

  assert.deepEqual(payload, {
    preferences: [
      {
        source_module: "maintenance",
        channel: "email",
        is_enabled: true,
      },
      {
        source_module: "",
        channel: "push",
        is_enabled: false,
      },
      {
        source_module: "maintenance",
        channel: "sms",
        is_enabled: null,
      },
    ],
  });
});

test("effective preference resolution prefers module override over channel default", () => {
  assert.equal(
    resolveEffectivePreference({
      channel: "email",
      defaults: platformDefaults,
      storedPreferences,
    }),
    true,
  );
  assert.equal(
    resolveEffectivePreference({
      channel: "email",
      sourceModule: "maintenance",
      defaults: platformDefaults,
      storedPreferences,
    }),
    false,
  );
  assert.equal(
    resolveEffectivePreference({
      channel: "sms",
      sourceModule: "inspection",
      defaults: platformDefaults,
      storedPreferences,
    }),
    false,
  );
});

test("missing module preference maps to inherit", () => {
  assert.equal(storedModulePreferenceToState(undefined), "inherit");
});

test("explicit true maps to enabled", () => {
  assert.equal(
    storedModulePreferenceToState({
      id: "1",
      source_module: "maintenance",
      channel: "email",
      is_enabled: true,
      created_at: "2026-07-13T12:00:00.000Z",
      updated_at: "2026-07-13T12:00:00.000Z",
    }),
    "enabled",
  );
});

test("explicit false maps to disabled", () => {
  assert.equal(
    storedModulePreferenceToState({
      id: "1",
      source_module: "maintenance",
      channel: "email",
      is_enabled: false,
      created_at: "2026-07-13T12:00:00.000Z",
      updated_at: "2026-07-13T12:00:00.000Z",
    }),
    "disabled",
  );
});

test("inherited effective value follows channel default", () => {
  const response = {
    defaults: platformDefaults,
    preferences: storedPreferences,
  };
  const moduleStates = buildModuleFormState(response);

  assert.equal(moduleStates[buildPreferenceKey("inspection", "email")], "inherit");
  assert.equal(
    resolveEffectivePreference({
      channel: "email",
      sourceModule: "inspection",
      defaults: platformDefaults,
      storedPreferences,
    }),
    true,
  );
  assert.equal(
    formatEffectivePreferenceLabel(
      resolveEffectivePreference({
        channel: "email",
        sourceModule: "inspection",
        defaults: platformDefaults,
        storedPreferences,
      }),
    ),
    "Uses channel default: Enabled",
  );
});

test("changing a channel default does not change the module control from inherit", () => {
  const response = {
    defaults: platformDefaults,
    preferences: storedPreferences,
  };
  const initialModuleStates = buildModuleFormState(response);
  const initialChannelDefaults = buildChannelDefaultFormState(response);

  const nextChannelDefaults = {
    ...initialChannelDefaults,
    [buildPreferenceKey("", "email")]: false,
  };

  const changes = buildPreferenceChanges({
    channelDefaults: nextChannelDefaults,
    initialChannelDefaults,
    moduleStates: initialModuleStates,
    initialModuleStates,
  });

  assert.deepEqual(changes, [
    {
      source_module: "",
      channel: "email",
      is_enabled: false,
    },
  ]);
  assert.equal(
    initialModuleStates[buildPreferenceKey("inspection", "email")],
    "inherit",
  );
});

test("existing override changed to inherit creates a null deletion instruction", () => {
  const response = {
    defaults: platformDefaults,
    preferences: storedPreferences,
  };
  const initialModuleStates = buildModuleFormState(response);
  const initialChannelDefaults = buildChannelDefaultFormState(response);
  const nextModuleStates = {
    ...initialModuleStates,
    [buildPreferenceKey("maintenance", "email")]: "inherit" as const,
  };

  const changes = buildPreferenceChanges({
    channelDefaults: initialChannelDefaults,
    initialChannelDefaults,
    moduleStates: nextModuleStates,
    initialModuleStates,
  });

  assert.deepEqual(changes, [
    {
      source_module: "maintenance",
      channel: "email",
      is_enabled: null,
    },
  ]);
});

test("unchanged inherited controls are not submitted", () => {
  const response = {
    defaults: platformDefaults,
    preferences: storedPreferences,
  };
  const initialModuleStates = buildModuleFormState(response);
  const initialChannelDefaults = buildChannelDefaultFormState(response);

  const changes = buildPreferenceChanges({
    channelDefaults: initialChannelDefaults,
    initialChannelDefaults,
    moduleStates: initialModuleStates,
    initialModuleStates,
  });

  assert.deepEqual(changes, []);
});

test("save-response reconstruction preserves all three states", () => {
  const response = {
    defaults: platformDefaults,
    preferences: [
      {
        id: "1",
        source_module: "",
        channel: "email" as const,
        is_enabled: true,
        created_at: "2026-07-13T12:00:00.000Z",
        updated_at: "2026-07-13T12:00:00.000Z",
      },
      {
        id: "2",
        source_module: "maintenance",
        channel: "email" as const,
        is_enabled: true,
        created_at: "2026-07-13T12:00:00.000Z",
        updated_at: "2026-07-13T12:00:00.000Z",
      },
      {
        id: "3",
        source_module: "inspection",
        channel: "sms" as const,
        is_enabled: false,
        created_at: "2026-07-13T12:00:00.000Z",
        updated_at: "2026-07-13T12:00:00.000Z",
      },
    ],
  };

  const formState = buildFormStateFromResponse(response);

  assert.equal(
    formState.moduleStates[buildPreferenceKey("fm_tickets", "email")],
    "inherit",
  );
  assert.equal(
    formState.moduleStates[buildPreferenceKey("maintenance", "email")],
    "enabled",
  );
  assert.equal(
    formState.moduleStates[buildPreferenceKey("inspection", "sms")],
    "disabled",
  );
  assert.equal(
    formState.channelDefaults[buildPreferenceKey("", "email")],
    true,
  );
});

test("source module normalization accepts supported modules and blanks unknown values", () => {
  assert.equal(normalizeNotificationSourceModule(" FM_Tickets "), "fm_tickets");
  assert.equal(normalizeNotificationSourceModule("maintenance"), "maintenance");
  assert.equal(normalizeNotificationSourceModule("unknown"), "");
});

test("preference keys remain stable for query caching", () => {
  assert.equal(buildPreferenceKey("", "email"), "default::email");
  assert.equal(buildPreferenceKey("inspection", "push"), "inspection::push");
  assert.deepEqual(notificationQueryKeys.preferences(), [
    "notifications",
    "preferences",
  ]);
});

test("external delivery availability message is explicit", () => {
  assert.match(
    EXTERNAL_DELIVERY_AVAILABILITY_MESSAGE,
    /not connected yet/i,
  );
});

test("preference helper messages format success and fallback errors", () => {
  assert.equal(
    formatNotificationPreferenceSuccess(),
    "Notification preferences saved.",
  );
  assert.equal(
    formatNotificationPreferenceError(new Error("Preference write failed.")),
    "Preference write failed.",
  );
  assert.equal(
    formatNotificationPreferenceError({}),
    "Unable to update notification preferences right now.",
  );
});
