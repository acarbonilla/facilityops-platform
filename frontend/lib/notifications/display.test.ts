import assert from "node:assert/strict";
import test from "node:test";

import { notificationQueryKeys } from "@/services/api/query-keys";
import type { Notification, NotificationListFilters } from "@/types/notifications";

import {
  selectAllVisibleNotifications,
  toggleNotificationSelection,
} from "@/features/notifications/components/notification-bulk-actions";

import {
  buildNotificationListParams,
  buildBulkStatePayload,
  canSubmitBulkNotificationSelection,
  enforceMaximumNotificationSelection,
  formatNotificationMutationSuccess,
  formatNotificationSeverityLabel,
  formatNotificationSourceModule,
  formatNotificationTimestamp,
  formatUnreadBadgeCount,
  getBulkNotificationActionLabel,
  getIndividualNotificationActionLabel,
  getMaximumNotificationSelectionStatus,
  getSafeNotificationTargetUrl,
  hasActiveNotificationFilters,
  MAX_NOTIFICATION_BULK_SELECTION,
  normalizeSelectedNotificationIds,
  pruneNotificationSelection,
} from "./display";

function makeNotification(id: string): Notification {
  return {
    id,
    event_code: "test.event",
    title: "Test notification",
    message: "Test message",
    severity: "info",
    target_url: null,
    source_module: "notifications",
    source_object_id: null,
    metadata: {},
    is_read: false,
    read_at: null,
    created_at: "2026-07-13T12:00:00.000Z",
    updated_at: "2026-07-13T12:00:00.000Z",
  };
}

test("unread badge formatting hides zero and caps at 99+", () => {
  assert.equal(formatUnreadBadgeCount(0), null);
  assert.equal(formatUnreadBadgeCount(-1), null);
  assert.equal(formatUnreadBadgeCount(5), "5");
  assert.equal(formatUnreadBadgeCount(99), "99");
  assert.equal(formatUnreadBadgeCount(100), "99+");
  assert.equal(formatUnreadBadgeCount(250), "99+");
});

test("severity display mapping capitalizes known values", () => {
  assert.equal(formatNotificationSeverityLabel("info"), "Info");
  assert.equal(formatNotificationSeverityLabel("success"), "Success");
  assert.equal(formatNotificationSeverityLabel("warning"), "Warning");
  assert.equal(formatNotificationSeverityLabel("error"), "Error");
});

test("source module labels format snake_case values", () => {
  assert.equal(formatNotificationSourceModule("maintenance"), "Maintenance");
  assert.equal(formatNotificationSourceModule("fm_tickets"), "Fm Tickets");
  assert.equal(formatNotificationSourceModule(""), null);
  assert.equal(formatNotificationSourceModule(null), null);
});

test("timestamp formatting falls back for missing and invalid values", () => {
  assert.equal(formatNotificationTimestamp(null), "Unknown time");
  assert.equal(formatNotificationTimestamp(undefined), "Unknown time");
  assert.equal(formatNotificationTimestamp("not-a-date"), "not-a-date");
});

test("timestamp formatting uses relative time for recent notifications", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");
  const fiveMinutesAgo = "2026-07-13T11:55:00.000Z";
  const formatted = formatNotificationTimestamp(fiveMinutesAgo, now);
  assert.match(formatted, /minute/i);
});

test("safe internal target URL acceptance permits single-slash paths", () => {
  assert.equal(getSafeNotificationTargetUrl("/dashboard"), "/dashboard");
  assert.equal(
    getSafeNotificationTargetUrl("/maintenance/work-orders/123/"),
    "/maintenance/work-orders/123/",
  );
  assert.equal(getSafeNotificationTargetUrl("  /profile  "), "/profile");
});

test("absolute URL rejection blocks http and https values", () => {
  assert.equal(getSafeNotificationTargetUrl("https://example.com"), null);
  assert.equal(getSafeNotificationTargetUrl("http://example.com/path"), null);
});

test("protocol-relative URL rejection blocks double-slash values", () => {
  assert.equal(getSafeNotificationTargetUrl("//example.com/path"), null);
});

test("scheme and malformed target rejection blocks unsafe values", () => {
  assert.equal(getSafeNotificationTargetUrl("javascript:alert(1)"), null);
  assert.equal(getSafeNotificationTargetUrl("mailto:user@example.com"), null);
  assert.equal(getSafeNotificationTargetUrl("not-a-path"), null);
  assert.equal(getSafeNotificationTargetUrl("\0/bad"), null);
});

test("backslash and encoded backslash navigation attempts are rejected", () => {
  assert.equal(getSafeNotificationTargetUrl("/\\evil.com"), null);
  assert.equal(getSafeNotificationTargetUrl("/%5Cevil.com"), null);
  assert.equal(getSafeNotificationTargetUrl("/%5cevil.com"), null);
});

test("encoded protocol-relative navigation attempts are rejected", () => {
  assert.equal(getSafeNotificationTargetUrl("/%2Fevil.com"), null);
  assert.equal(getSafeNotificationTargetUrl("/%2fevil.com"), null);
  assert.equal(getSafeNotificationTargetUrl("/%252Fevil.com"), null);
});

test("control characters and malformed percent encoding are rejected", () => {
  assert.equal(getSafeNotificationTargetUrl("/dashboard\nattack"), null);
  assert.equal(getSafeNotificationTargetUrl("/dashboard\rattack"), null);
  assert.equal(getSafeNotificationTargetUrl("/dashboard\tattack"), null);
  assert.equal(getSafeNotificationTargetUrl("/dashboard\u0000attack"), null);
  assert.equal(getSafeNotificationTargetUrl("/bad%"), null);
  assert.equal(getSafeNotificationTargetUrl("/bad%2"), null);
  assert.equal(getSafeNotificationTargetUrl("/bad%ZZ"), null);
});

test("valid internal paths with query strings and fragments are accepted", () => {
  assert.equal(
    getSafeNotificationTargetUrl("/notifications?status=unread"),
    "/notifications?status=unread",
  );
  assert.equal(
    getSafeNotificationTargetUrl("/dashboard#summary"),
    "/dashboard#summary",
  );
  assert.equal(
    getSafeNotificationTargetUrl(
      "/maintenance/work-orders/123/?tab=history#notes",
    ),
    "/maintenance/work-orders/123/?tab=history#notes",
  );
});

test("empty target URL behavior returns null", () => {
  assert.equal(getSafeNotificationTargetUrl(""), null);
  assert.equal(getSafeNotificationTargetUrl("   "), null);
  assert.equal(getSafeNotificationTargetUrl(null), null);
});

test("filter-to-query mapping omits inactive filters and applies read state", () => {
  const filters: NotificationListFilters = {
    readState: "unread",
    severity: "warning",
    sourceModule: "maintenance",
    pageSize: 20,
  };

  assert.deepEqual(buildNotificationListParams(filters, 2), {
    page: 2,
    page_size: 20,
    ordering: "-created_at",
    is_read: false,
    severity: "warning",
    source_module: "maintenance",
  });

  const cleared: NotificationListFilters = {
    readState: "",
    severity: "",
    sourceModule: "  ",
    pageSize: 10,
  };

  assert.deepEqual(buildNotificationListParams(cleared, 1), {
    page: 1,
    page_size: 10,
    ordering: "-created_at",
  });
  assert.equal(hasActiveNotificationFilters(cleared), false);
  assert.equal(hasActiveNotificationFilters(filters), true);
});

test("notification query keys vary with list params", () => {
  const base = notificationQueryKeys.list({
    page: 1,
    page_size: 5,
    ordering: "-created_at",
  });
  assert.notDeepEqual(
    base,
    notificationQueryKeys.list({
      page: 2,
      page_size: 5,
      ordering: "-created_at",
    }),
  );
  assert.notDeepEqual(
    base,
    notificationQueryKeys.list({
      page: 1,
      page_size: 5,
      ordering: "-created_at",
      is_read: false,
    }),
  );
  assert.notDeepEqual(
    notificationQueryKeys.unreadCount(),
    notificationQueryKeys.detail("notification-id"),
  );
});

test("bulk payload creation normalizes duplicate selected IDs", () => {
  assert.deepEqual(
    buildBulkStatePayload(["id-1", "id-1", " id-2 "], true),
    {
      notification_ids: ["id-1", "id-2"],
      is_read: true,
    },
  );
});

test("maximum selection enforcement caps bulk payloads at 100 IDs", () => {
  const ids = Array.from({ length: 120 }, (_, index) => `notification-${index}`);
  const limited = enforceMaximumNotificationSelection(ids);

  assert.equal(limited.length, 100);
  assert.equal(limited[0], "notification-0");
  assert.equal(limited[99], "notification-99");
});

test("selection cleanup keeps only visible notification IDs", () => {
  const pruned = pruneNotificationSelection(
    ["visible-1", "hidden-1", "visible-2"],
    ["visible-1", "visible-2"],
  );

  assert.deepEqual(pruned, ["visible-1", "visible-2"]);
});

test("read and unread action labels map to the expected button text", () => {
  assert.equal(getIndividualNotificationActionLabel(false), "Mark as read");
  assert.equal(getIndividualNotificationActionLabel(true), "Mark as unread");
  assert.equal(getBulkNotificationActionLabel(true), "Mark selected as read");
  assert.equal(getBulkNotificationActionLabel(false), "Mark selected as unread");
});

test("mutation response formatting includes updated counts", () => {
  assert.equal(
    formatNotificationMutationSuccess("All notifications marked as read.", 3),
    "All notifications marked as read. 3 notifications updated.",
  );
  assert.equal(
    formatNotificationMutationSuccess("Notification updated."),
    "Notification updated.",
  );
});

test("selected ID normalization removes empty and duplicate values", () => {
  assert.deepEqual(
    normalizeSelectedNotificationIds(["a", "a", "", "  ", "b"]),
    ["a", "b"],
  );
});

test("bulk selection boundary allows 99 items and accepts the 100th", () => {
  const firstNinetyNine = Array.from({ length: 99 }, (_, index) => `id-${index}`);
  const withHundredth = toggleNotificationSelection(
    firstNinetyNine,
    "id-99",
    true,
  );

  assert.equal(withHundredth.length, 100);
  assert.equal(canSubmitBulkNotificationSelection(withHundredth.length), true);
});

test("bulk selection boundary keeps exactly 100 selected IDs submittable", () => {
  const exactlyOneHundred = Array.from({ length: 100 }, (_, index) => `id-${index}`);

  assert.equal(exactlyOneHundred.length, MAX_NOTIFICATION_BULK_SELECTION);
  assert.equal(canSubmitBulkNotificationSelection(exactlyOneHundred.length), true);
  assert.deepEqual(
    buildBulkStatePayload(exactlyOneHundred, true).notification_ids.length,
    100,
  );
});

test("bulk selection boundary rejects adding item 101", () => {
  const exactlyOneHundred = Array.from({ length: 100 }, (_, index) => `id-${index}`);
  const afterAttempt = toggleNotificationSelection(
    exactlyOneHundred,
    "id-100",
    true,
  );

  assert.deepEqual(afterAttempt, exactlyOneHundred);
  assert.equal(afterAttempt.length, 100);
});

test("bulk selection boundary still allows deselecting at the maximum", () => {
  const exactlyOneHundred = Array.from({ length: 100 }, (_, index) => `id-${index}`);
  const afterDeselect = toggleNotificationSelection(
    exactlyOneHundred,
    "id-0",
    false,
  );

  assert.equal(afterDeselect.length, 99);
  assert.equal(canSubmitBulkNotificationSelection(afterDeselect.length), true);
});

test("bulk payload creation preserves exactly 100 unique IDs", () => {
  const ids = Array.from({ length: 100 }, (_, index) => `notification-${index}`);
  const payload = buildBulkStatePayload(ids, false);

  assert.equal(payload.notification_ids.length, 100);
  assert.equal(new Set(payload.notification_ids).size, 100);
  assert.equal(payload.is_read, false);
});

test("select-all-visible caps merged selection at 100 notifications", () => {
  const visible = Array.from({ length: 150 }, (_, index) =>
    makeNotification(`visible-${index}`),
  );
  const existing = Array.from({ length: 10 }, (_, index) => `existing-${index}`);
  const merged = selectAllVisibleNotifications(visible, existing);

  assert.equal(merged.length, 100);
  assert.equal(merged[0], "existing-0");
  assert.equal(merged[9], "existing-9");
  assert.equal(merged[99], "visible-89");
});

test("maximum selection status message stays neutral at the boundary", () => {
  assert.match(
    getMaximumNotificationSelectionStatus(),
    /apply a bulk action or deselect notifications/i,
  );
  assert.doesNotMatch(
    getMaximumNotificationSelectionStatus(),
    /deselect one or more notifications before adding more/i,
  );
});
