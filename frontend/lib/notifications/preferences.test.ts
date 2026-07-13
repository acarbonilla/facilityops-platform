import assert from "node:assert/strict";
import test from "node:test";

import { notificationQueryKeys } from "@/services/api/query-keys";

import {
  buildPreferenceKey,
  buildPreferenceUpdatePayload,
  EXTERNAL_DELIVERY_AVAILABILITY_MESSAGE,
  formatNotificationPreferenceError,
  formatNotificationPreferenceSuccess,
  normalizeNotificationSourceModule,
  resolveEffectivePreference,
} from "./preferences";

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
    ],
  });
});

test("effective preference resolution prefers module override over channel default", () => {
  const defaults = {
    in_app: true,
    email: false,
    sms: false,
    push: false,
  };
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

  assert.equal(
    resolveEffectivePreference({
      channel: "email",
      defaults,
      storedPreferences,
    }),
    true,
  );
  assert.equal(
    resolveEffectivePreference({
      channel: "email",
      sourceModule: "maintenance",
      defaults,
      storedPreferences,
    }),
    false,
  );
  assert.equal(
    resolveEffectivePreference({
      channel: "sms",
      sourceModule: "inspection",
      defaults,
      storedPreferences,
    }),
    false,
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
