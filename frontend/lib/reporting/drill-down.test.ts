import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInspectionDrillDownHref,
  buildTicketDrillDownHref,
  buildWorkOrderDrillDownHref,
} from "./drill-down";
import { getReportingDrillDownVisibility } from "./drill-down-visibility";
import type { ReportingActiveFilters } from "@/types/reporting";

const FILTERS: ReportingActiveFilters = {
  dateFrom: "2026-04-17",
  dateTo: "2026-07-16",
  organization: "11111111-1111-4111-8111-111111111111",
  building: "22222222-2222-4222-8222-222222222222",
  ticketStatus: "assigned",
  ticketPriority: "medium",
  workOrderStatus: "in_progress",
  workOrderPriority: "high",
  inspectionStatus: "scheduled",
};

function parse(href: string | null) {
  assert.ok(href);
  return new URL(href, "https://example.test");
}

test("ticket drill-down maps only supported ticket filters", () => {
  const url = parse(buildTicketDrillDownHref(FILTERS));
  assert.equal(url.pathname, "/fm-tickets");
  assert.equal(url.searchParams.get("status"), "assigned");
  assert.equal(url.searchParams.get("priority"), "medium");
  assert.equal(url.searchParams.get("work_order_status"), null);
  assert.equal(url.searchParams.get("tenant"), null);
  assert.equal(url.searchParams.get("date_from"), null);
});

test("work order drill-down maps supported filters to requested dates", () => {
  const url = parse(buildWorkOrderDrillDownHref(FILTERS));
  assert.equal(url.pathname, "/maintenance/work-orders");
  assert.equal(url.searchParams.get("status"), "in_progress");
  assert.equal(url.searchParams.get("priority"), "high");
  assert.equal(url.searchParams.get("requested_from"), "2026-04-17");
  assert.equal(url.searchParams.get("requested_to"), "2026-07-16");
  assert.equal(url.searchParams.get("created_from"), null);
  assert.equal(url.searchParams.get("ticket_status"), null);
});

test("inspection drill-down maps inspection status and omits dates", () => {
  const url = parse(buildInspectionDrillDownHref(FILTERS));
  assert.equal(url.pathname, "/inspection/inspections");
  assert.equal(url.searchParams.get("status"), "scheduled");
  assert.equal(url.searchParams.get("priority"), null);
  assert.equal(url.searchParams.get("requested_from"), null);
});

test("work order drill-down rejects impossible calendar dates", () => {
  const url = parse(
    buildWorkOrderDrillDownHref({
      ...FILTERS,
      dateFrom: "2026-02-30",
      dateTo: "2026-99-99",
    }),
  );
  assert.equal(url.searchParams.get("requested_from"), null);
  assert.equal(url.searchParams.get("requested_to"), null);
});

test("blank filters are omitted", () => {
  const url = parse(
    buildTicketDrillDownHref({
      ...FILTERS,
      ticketStatus: "",
      ticketPriority: " ",
      organization: "",
      building: "",
    }),
  );
  assert.equal(url.searchParams.get("status"), null);
  assert.equal(url.searchParams.get("priority"), null);
  assert.equal(url.searchParams.get("organization"), null);
});

test("malformed values fail closed", () => {
  const url = parse(
    buildWorkOrderDrillDownHref({
      ...FILTERS,
      workOrderStatus: "bad",
      workOrderPriority: "bad",
      dateFrom: "bad",
      dateTo: "bad",
    }),
  );
  assert.equal(url.searchParams.get("status"), null);
  assert.equal(url.searchParams.get("priority"), null);
  assert.equal(url.searchParams.get("created_from"), null);
});

test("drill-down hrefs remain internal relative paths", () => {
  assert.ok(buildTicketDrillDownHref(FILTERS)?.startsWith("/fm-tickets"));
  assert.ok(
    buildWorkOrderDrillDownHref(FILTERS)?.startsWith(
      "/maintenance/work-orders",
    ),
  );
  assert.ok(
    buildInspectionDrillDownHref(FILTERS)?.startsWith(
      "/inspection/inspections",
    ),
  );
});

test("permission-aware visibility hides unauthorized actions", () => {
  assert.deepEqual(
    getReportingDrillDownVisibility({
      permissionsLoading: false,
      canViewTickets: true,
      canViewWorkOrders: false,
      canViewInspections: true,
    }),
    { tickets: true, workOrders: false, inspections: true },
  );
  assert.deepEqual(
    getReportingDrillDownVisibility({
      permissionsLoading: true,
      canViewTickets: true,
      canViewWorkOrders: true,
      canViewInspections: true,
    }),
    { tickets: false, workOrders: false, inspections: false },
  );
});
