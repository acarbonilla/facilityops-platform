import assert from "node:assert/strict";
import test from "node:test";

import { notificationQueryKeys } from "@/services/api/query-keys";
import type { NotificationListFilters } from "@/types/notifications";

import {
  buildNotificationListParams,
  formatNotificationSeverityLabel,
  formatNotificationSourceModule,
  formatNotificationTimestamp,
  formatUnreadBadgeCount,
  getSafeNotificationTargetUrl,
  hasActiveNotificationFilters,
} from "./display";

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
