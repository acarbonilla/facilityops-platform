import assert from "node:assert/strict";
import test from "node:test";

import { API_ENDPOINTS } from "@/services/api/endpoints";
import { reportingQueryKeys } from "@/services/api/query-keys";

import {
  canApplyReportingFilters,
  clearIncompatibleBuilding,
  createDefaultReportingFilters,
  filterReportingBuildingsByOrganization,
  formatActiveReportingFilterSummary,
  formatCurrentReportingPeriodLabel,
  formatReportingActivePeriod,
  omitBlankReportingParams,
  resetReportingFilters,
  serializeReportingOverviewParams,
} from "./filters";

test("blank reporting parameters are omitted", () => {
  assert.deepEqual(
    omitBlankReportingParams({
      date_from: "2026-01-01",
      date_to: "2026-01-31",
      organization: "",
      building: "   ",
    }),
    {
      date_from: "2026-01-01",
      date_to: "2026-01-31",
    },
  );
});

test("only approved parameters are serialized as date-only bounds", () => {
  const params = serializeReportingOverviewParams({
    dateFrom: "2026-04-17",
    dateTo: "2026-07-16",
    organization: "11111111-1111-1111-1111-111111111111",
    building: "22222222-2222-2222-2222-222222222222",
  });

  assert.ok(params);
  assert.deepEqual(Object.keys(params!).sort(), [
    "building",
    "date_from",
    "date_to",
    "organization",
  ]);
  assert.equal(params!.date_from, "2026-04-17");
  assert.equal(params!.date_to, "2026-07-16");
  assert.equal(params!.date_from.includes("T"), false);
  assert.equal(params!.date_to.includes("T"), false);
  assert.equal(
    "status" in (params as object) || "priority" in (params as object),
    false,
  );
  assert.equal("tenant" in (params as object), false);
});

test("exact 180-day selection serializes without clamp or ISO conversion", () => {
  const params = serializeReportingOverviewParams({
    dateFrom: "2026-01-16",
    dateTo: "2026-07-15",
    organization: "",
    building: "",
  });
  assert.deepEqual(params, {
    date_from: "2026-01-16",
    date_to: "2026-07-15",
  });
});

test("181-day selection fails closed during serialization", () => {
  assert.equal(
    serializeReportingOverviewParams({
      dateFrom: "2026-01-15",
      dateTo: "2026-07-15",
      organization: "",
      building: "",
    }),
    null,
  );
});

test("organization change clears incompatible building using organization_id", () => {
  const buildings = [
    {
      id: "b1",
      organization_id: "org-a",
    },
    {
      id: "b2",
      organization_id: "org-b",
    },
  ];

  assert.equal(clearIncompatibleBuilding("org-a", "b1", buildings), "b1");
  assert.equal(clearIncompatibleBuilding("org-a", "b2", buildings), "");
  assert.equal(clearIncompatibleBuilding("", "b2", buildings), "b2");
});

test("buildings narrow by selected organization_id", () => {
  const buildings = [
    { id: "b1", name: "North", organization_id: "org-a" },
    { id: "b2", name: "South", organization_id: "org-b" },
  ];

  assert.deepEqual(
    filterReportingBuildingsByOrganization(buildings, "org-a").map(
      (item) => item.id,
    ),
    ["b1"],
  );
  assert.equal(
    filterReportingBuildingsByOrganization(buildings, "").length,
    2,
  );
});

test("reset returns default dates and clears master-data filters", () => {
  const reference = new Date(2026, 6, 16);
  const reset = resetReportingFilters(reference);
  const defaults = createDefaultReportingFilters(reference);

  assert.deepEqual(reset, defaults);
  assert.equal(reset.organization, "");
  assert.equal(reset.building, "");
  assert.equal(reset.dateFrom, "2026-04-17");
  assert.equal(reset.dateTo, "2026-07-16");
});

test("active filter summary does not duplicate Current period Period wording", () => {
  assert.equal(
    formatReportingActivePeriod({
      dateFrom: "2026-04-17",
      dateTo: "2026-07-16",
    }),
    "2026-04-17 to 2026-07-16",
  );

  assert.equal(
    formatActiveReportingFilterSummary({
      dateFrom: "2026-04-17",
      dateTo: "2026-07-16",
      organization: "",
      building: "",
    }),
    "2026-04-17 to 2026-07-16",
  );

  assert.equal(
    formatCurrentReportingPeriodLabel({
      dateFrom: "2026-04-17",
      dateTo: "2026-07-16",
      organization: "",
      building: "",
    }),
    "Current period: 2026-04-17 to 2026-07-16",
  );

  assert.equal(
    formatCurrentReportingPeriodLabel({
      dateFrom: "2026-04-17",
      dateTo: "2026-07-16",
      organization: "",
      building: "",
    }).includes("Current period: Period"),
    false,
  );

  assert.equal(
    formatActiveReportingFilterSummary(
      {
        dateFrom: "2026-04-17",
        dateTo: "2026-07-16",
        organization: "org-1",
        building: "bld-1",
      },
      {
        organizationName: "Acme Facilities",
        buildingName: "North Wing",
      },
    ),
    "2026-04-17 to 2026-07-16 · Organization: Acme Facilities · Building: North Wing",
  );
});

test("apply is disabled for invalid dates or unavailable option selections", () => {
  assert.equal(
    canApplyReportingFilters({
      dateFrom: "2026-07-16",
      dateTo: "2026-07-15",
      organization: "",
      building: "",
    }),
    false,
  );

  assert.equal(
    canApplyReportingFilters(
      {
        dateFrom: "2026-04-17",
        dateTo: "2026-07-16",
        organization: "missing-org",
        building: "",
      },
      {
        organizationIds: ["org-1"],
        buildingIds: [],
        optionsReady: true,
      },
    ),
    false,
  );

  assert.equal(
    canApplyReportingFilters(
      {
        dateFrom: "2026-04-17",
        dateTo: "2026-07-16",
        organization: "stale-org",
        building: "",
      },
      {
        optionsReady: false,
      },
    ),
    false,
  );

  assert.equal(
    canApplyReportingFilters({
      dateFrom: "2026-04-17",
      dateTo: "2026-07-16",
      organization: "",
      building: "",
    }),
    true,
  );
});

test("reporting filter-options endpoint constant and query key are stable", () => {
  assert.equal(
    API_ENDPOINTS.reporting.filterOptions,
    "/reporting/filter-options/",
  );
  assert.deepEqual(reportingQueryKeys.filterOptions(), [
    "reporting",
    "filter-options",
  ]);
  assert.equal(
    API_ENDPOINTS.reporting.filterOptions.includes("master-data"),
    false,
  );
});

test("module filters serialize canonically and reset to blanks", () => {
  const params = serializeReportingOverviewParams({
    dateFrom: "2026-04-17",
    dateTo: "2026-07-16",
    organization: "",
    building: "",
    ticketStatus: "assigned",
    ticketPriority: "medium",
    workOrderStatus: "in_progress",
    workOrderPriority: "critical",
    inspectionStatus: "scheduled",
  });
  assert.equal(params?.ticket_status, "assigned");
  assert.equal(params?.ticket_priority, "medium");
  assert.equal(params?.work_order_status, "in_progress");
  assert.equal(params?.work_order_priority, "critical");
  assert.equal(params?.inspection_status, "scheduled");
  const reset = resetReportingFilters(new Date(2026, 6, 16));
  assert.equal(reset.ticketStatus, "");
  assert.equal(reset.workOrderPriority, "");
  assert.equal(reset.inspectionStatus, "");
});

test("module query keys are stable, distinct, and summaries are qualified", () => {
  const ticket = reportingQueryKeys.overview({
    ticket_status: " assigned ",
    ticket_priority: "",
  });
  const equivalent = reportingQueryKeys.overview({
    ticket_status: "assigned",
  });
  const workOrder = reportingQueryKeys.overview({
    work_order_status: "assigned",
  });
  assert.deepEqual(ticket, equivalent);
  assert.notDeepEqual(ticket, workOrder);
  assert.equal(
    formatActiveReportingFilterSummary({
      dateFrom: "2026-04-17",
      dateTo: "2026-07-16",
      organization: "",
      building: "",
      ticketStatus: "assigned",
      workOrderPriority: "critical",
    }),
    "2026-04-17 to 2026-07-16 · Ticket Status: Assigned · Work Order Priority: Critical",
  );
});
