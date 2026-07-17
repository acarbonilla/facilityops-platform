import assert from "node:assert/strict";
import test from "node:test";

import { API_ENDPOINTS } from "@/services/api/endpoints";
import { dashboardQueryKeys } from "@/services/api/query-keys";
import { ApiError } from "@/services/api/types";
import type { FoundationSummary } from "@/types/dashboard";

import {
  buildDashboardSystemStatus,
  formatDashboardHealthLabel,
  formatDashboardSummaryError,
  isDashboardUnauthorizedError,
} from "./display";
import {
  FOUNDATION_METRIC_DEFINITIONS,
  isAllZeroFoundationSummary,
  mapFoundationMetrics,
} from "./metrics";
import {
  DASHBOARD_MASTER_DATA_LINKS,
  DASHBOARD_REPORTING_LINK,
  getVisibleDashboardQuickLinks,
  MASTER_DATA_QUICK_LINK_PERMISSION,
  shouldShowDashboardReportingLink,
} from "./navigation";
import { isDashboardQueryEnabled } from "./query";
import {
  DASHBOARD_SCOPE_SUMMARY,
  DASHBOARD_SCOPE_SUPPORTING,
  DASHBOARD_ZERO_CONTEXT,
  getDashboardScopeMessages,
} from "./scope";

function sampleSummary(
  overrides?: Partial<FoundationSummary>,
): FoundationSummary {
  return {
    tenants: 1,
    organizations: 2,
    departments: 3,
    buildings: 4,
    floors: 5,
    areas: 6,
    asset_types: 7,
    assets: 8,
    service: "facilityops-backend",
    ...overrides,
  };
}

test("dashboard foundation-summary query key is stable and tenant-free", () => {
  const key = dashboardQueryKeys.foundationSummary();
  assert.deepEqual(key, ["dashboard", "foundation-summary"]);
  assert.equal(JSON.stringify(key).includes("tenant"), false);
  assert.equal(API_ENDPOINTS.dashboard.foundationSummary.includes("tenant"), false);
  assert.equal(
    API_ENDPOINTS.dashboard.foundationSummary,
    "/dashboard/foundation-summary/",
  );
});

test("dashboard queries stay disabled during auth restoration", () => {
  assert.equal(
    isDashboardQueryEnabled({ isLoading: true, isAuthenticated: false }),
    false,
  );
  assert.equal(
    isDashboardQueryEnabled({ isLoading: true, isAuthenticated: true }),
    false,
  );
});

test("dashboard queries stay disabled for logged-out users", () => {
  assert.equal(
    isDashboardQueryEnabled({ isLoading: false, isAuthenticated: false }),
    false,
  );
});

test("dashboard queries enable only when authenticated and settled", () => {
  assert.equal(
    isDashboardQueryEnabled({ isLoading: false, isAuthenticated: true }),
    true,
  );
});

test("scope copy stays neutral and non-technical", () => {
  const messages = getDashboardScopeMessages();
  assert.equal(messages.summary, DASHBOARD_SCOPE_SUMMARY);
  assert.equal(messages.supporting, DASHBOARD_SCOPE_SUPPORTING);
  assert.equal(messages.zeroContext, DASHBOARD_ZERO_CONTEXT);
  assert.match(messages.summary, /available to your account/i);
  assert.doesNotMatch(messages.summary, /your tenant/i);
  assert.doesNotMatch(messages.supporting, /UUID|reporting\.view|\/api\//i);
});

test("all-zero foundation summary is detected without treating it as failure", () => {
  const empty = sampleSummary({
    tenants: 0,
    organizations: 0,
    departments: 0,
    buildings: 0,
    floors: 0,
    areas: 0,
    asset_types: 0,
    assets: 0,
  });
  assert.equal(isAllZeroFoundationSummary(empty), true);
  assert.equal(isAllZeroFoundationSummary(sampleSummary()), false);
});

test("foundation metrics map in stable order", () => {
  const cards = mapFoundationMetrics(sampleSummary());
  assert.deepEqual(
    cards.map((card) => card.id),
    FOUNDATION_METRIC_DEFINITIONS.map((metric) => metric.id),
  );
  assert.equal(cards[0]?.value, 1);
  assert.equal(cards[7]?.label, "Assets");
  assert.equal(cards[7]?.value, 8);
});

test("system status formatting isolates connectivity from summary success", () => {
  const healthy = buildDashboardSystemStatus({
    health: { status: "ok", service: "facilityops-backend" },
  });
  assert.equal(healthy.connected, true);
  assert.equal(formatDashboardHealthLabel(healthy), "Connected");
  assert.match(healthy.message, /connectivity is available/i);

  const degraded = buildDashboardSystemStatus({
    health: { status: "degraded", service: "facilityops-backend" },
  });
  assert.equal(degraded.connected, false);
  assert.equal(formatDashboardHealthLabel(degraded), "Degraded");

  const missing = buildDashboardSystemStatus({ healthFailed: true });
  assert.equal(missing.connected, false);
  assert.equal(formatDashboardHealthLabel(missing), "Unavailable");
  assert.match(missing.message, /could not be confirmed/i);
});

test("summary error formatting stays user-facing", () => {
  assert.equal(
    formatDashboardSummaryError(new ApiError("Unauthorized", 401)),
    "Your session expired or authentication is required.",
  );
  assert.equal(
    formatDashboardSummaryError(new ApiError("Forbidden", 403)),
    "Your account could not access foundation metrics.",
  );
  assert.equal(
    formatDashboardSummaryError(new ApiError("Boom", 500)),
    "The dashboard service failed while loading foundation metrics.",
  );
  assert.equal(
    formatDashboardSummaryError(new Error("Failed to fetch")),
    "Failed to fetch",
  );
  assert.equal(isDashboardUnauthorizedError(new ApiError("x", 401)), true);
  assert.equal(isDashboardUnauthorizedError(new ApiError("x", 500)), false);
});

test("reporting link is visible only with reporting.view when permissions are ready", () => {
  assert.equal(
    shouldShowDashboardReportingLink({
      permissionsLoading: false,
      permissionsError: false,
      canViewReporting: true,
    }),
    true,
  );

  const links = getVisibleDashboardQuickLinks({
    permissionsLoading: false,
    permissionsError: false,
    canViewMasterData: false,
    canViewReporting: true,
  });
  assert.deepEqual(links, [DASHBOARD_REPORTING_LINK]);
  assert.equal(DASHBOARD_REPORTING_LINK.href, "/reporting");
});

test("reporting link is hidden without permission", () => {
  assert.equal(
    shouldShowDashboardReportingLink({
      permissionsLoading: false,
      permissionsError: false,
      canViewReporting: false,
    }),
    false,
  );
});

test("reporting link is hidden while permissions load or fail", () => {
  assert.equal(
    shouldShowDashboardReportingLink({
      permissionsLoading: true,
      permissionsError: false,
      canViewReporting: true,
    }),
    false,
  );
  assert.equal(
    shouldShowDashboardReportingLink({
      permissionsLoading: false,
      permissionsError: true,
      canViewReporting: true,
    }),
    false,
  );
});

test("master-data quick links require settings.view and hide while loading", () => {
  assert.equal(MASTER_DATA_QUICK_LINK_PERMISSION, "settings.view");

  const visible = getVisibleDashboardQuickLinks({
    permissionsLoading: false,
    permissionsError: false,
    canViewMasterData: true,
    canViewReporting: false,
  });
  assert.deepEqual(visible, [...DASHBOARD_MASTER_DATA_LINKS]);

  const hiddenWhileLoading = getVisibleDashboardQuickLinks({
    permissionsLoading: true,
    permissionsError: false,
    canViewMasterData: true,
    canViewReporting: true,
  });
  assert.deepEqual(hiddenWhileLoading, []);

  const hiddenWithoutPermission = getVisibleDashboardQuickLinks({
    permissionsLoading: false,
    permissionsError: false,
    canViewMasterData: false,
    canViewReporting: false,
  });
  assert.deepEqual(hiddenWithoutPermission, []);
});
