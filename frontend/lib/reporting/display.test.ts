import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/services/api/types";
import { reportingQueryKeys } from "@/services/api/query-keys";

import {
  formatReportingAverageScore,
  formatReportingError,
  formatReportingNumber,
  formatReportingPriorityLabel,
  formatReportingStatusLabel,
  isReportingOverviewEmpty,
} from "./display";
import { APP_NAVIGATION } from "@/lib/navigation";
import {
  canViewReportingNav,
  filterNavigationForPermissions,
} from "./navigation";
import type { ReportingOperationalOverview } from "@/types/reporting";

function emptyOverview(
  overrides?: Partial<ReportingOperationalOverview>,
): ReportingOperationalOverview {
  return {
    filters: {
      date_from: "2026-04-17T00:00:00.000Z",
      date_to: "2026-07-16T23:59:59.999Z",
      building: null,
      organization: null,
    },
    tickets: {
      total: 0,
      open: 0,
      overdue: 0,
      by_status: {},
      by_priority: {},
      by_category: {},
      sla: {
        response_met: 0,
        response_missed: 0,
        resolution_met: 0,
        resolution_missed: 0,
      },
    },
    work_orders: {
      total: 0,
      overdue: 0,
      by_status: {},
      by_priority: {},
      linked_to_ticket: 0,
      standalone: 0,
    },
    inspections: {
      total: 0,
      by_status: {},
      average_score: null,
      scored_count: 0,
    },
    ...overrides,
  };
}

test("reporting query keys are stable for equivalent parameters", () => {
  const left = reportingQueryKeys.overview({
    date_from: "a",
    date_to: "b",
    organization: "",
    building: undefined,
  });
  const right = reportingQueryKeys.overview({
    date_from: "a",
    date_to: "b",
  });

  assert.deepEqual(left, right);
  assert.deepEqual(reportingQueryKeys.overviews(), ["reporting", "overview"]);
  assert.deepEqual(reportingQueryKeys.all, ["reporting"]);
});

test("reporting query keys differ for materially different filters", () => {
  const left = reportingQueryKeys.overview({
    date_from: "a",
    date_to: "b",
    organization: "org-1",
  });
  const right = reportingQueryKeys.overview({
    date_from: "a",
    date_to: "b",
    building: "bld-1",
  });

  assert.notDeepEqual(left, right);
});

test("blank and omitted reporting query params normalize consistently", () => {
  assert.deepEqual(
    reportingQueryKeys.overview({
      date_from: "  ",
      date_to: "value",
      building: null as unknown as undefined,
    }),
    reportingQueryKeys.overview({
      date_to: "value",
    }),
  );
});

test("status and priority labels convert machine values and fall back safely", () => {
  assert.equal(formatReportingStatusLabel("in_progress"), "In Progress");
  assert.equal(formatReportingPriorityLabel("critical"), "Critical");
  assert.equal(formatReportingStatusLabel("future_status_x"), "Future Status X");
  assert.equal(formatReportingPriorityLabel("brand_new"), "Brand New");
});

test("average score null handling and numeric formatting", () => {
  assert.equal(formatReportingAverageScore(null), "No scored inspections");
  assert.equal(formatReportingAverageScore(0), "0");
  assert.equal(formatReportingAverageScore(87.5), "87.5");
  assert.equal(formatReportingNumber(1200), "1,200");
});

test("empty overview detection uses zero totals across modules", () => {
  assert.equal(isReportingOverviewEmpty(emptyOverview()), true);
  assert.equal(
    isReportingOverviewEmpty(
      emptyOverview({
        tickets: {
          total: 1,
          open: 1,
          overdue: 0,
          by_status: {},
          by_priority: {},
          by_category: {},
          sla: {
            response_met: 0,
            response_missed: 0,
            resolution_met: 0,
            resolution_missed: 0,
          },
        },
      }),
    ),
    false,
  );
});

test("reporting error formatting covers field errors, 403, 404, and network failures", () => {
  const fieldError = new ApiError("Validation failed", 400, {
    message: "Validation failed",
    errors: {
      building: ["Must be a valid UUID."],
    },
  });
  assert.equal(
    formatReportingError(fieldError),
    "Building: Must be a valid UUID.",
  );

  assert.equal(
    formatReportingError(new ApiError("Forbidden", 403)),
    "Your account does not have permission to view reporting data.",
  );

  assert.equal(
    formatReportingError(new ApiError("Building not found.", 404)),
    "Building not found.",
  );

  assert.equal(
    formatReportingError(new Error("Failed to fetch")),
    "Failed to fetch",
  );

  assert.equal(
    formatReportingError(
      new ApiError("Forbidden", 403),
      "Organization and Building options could not be loaded.",
    ),
    "Your account does not have permission to view reporting data.",
  );
});

test("reporting navigation entry is permission gated", () => {
  assert.equal(canViewReportingNav(["reporting.view"]), true);
  assert.equal(canViewReportingNav(["fm_tickets.view"]), false);

  const withPermission = filterNavigationForPermissions(APP_NAVIGATION, {
    isAuthenticated: true,
    permissions: ["reporting.view"],
  });
  assert.ok(withPermission.some((item) => item.href === "/reporting"));

  const withoutPermission = filterNavigationForPermissions(APP_NAVIGATION, {
    isAuthenticated: true,
    permissions: ["fm_tickets.view"],
  });
  assert.equal(
    withoutPermission.some((item) => item.href === "/reporting"),
    false,
  );
});

test("reporting filter-options query key does not encode a tenant parameter", () => {
  const key = reportingQueryKeys.filterOptions();
  assert.deepEqual(key, ["reporting", "filter-options"]);
  assert.equal(JSON.stringify(key).includes("tenant"), false);
});
