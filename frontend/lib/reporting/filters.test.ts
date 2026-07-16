import assert from "node:assert/strict";
import test from "node:test";

import {
  canApplyReportingFilters,
  clearIncompatibleBuilding,
  createDefaultReportingFilters,
  formatActiveReportingFilterSummary,
  omitBlankReportingParams,
  resetReportingFilters,
  serializeReportingOverviewParams,
} from "./filters";

test("blank reporting parameters are omitted", () => {
  assert.deepEqual(
    omitBlankReportingParams({
      date_from: "2026-01-01T00:00:00.000Z",
      date_to: "2026-01-31T23:59:59.999Z",
      organization: "",
      building: "   ",
    }),
    {
      date_from: "2026-01-01T00:00:00.000Z",
      date_to: "2026-01-31T23:59:59.999Z",
    },
  );
});

test("only approved parameters are serialized", () => {
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
  assert.equal(
    "status" in (params as object) || "priority" in (params as object),
    false,
  );
  assert.equal("tenant" in (params as object), false);
});

test("organization change clears incompatible building", () => {
  const buildings = [
    {
      id: "b1",
      organization: "org-a",
    },
    {
      id: "b2",
      organization: "org-b",
    },
  ];

  assert.equal(clearIncompatibleBuilding("org-a", "b1", buildings), "b1");
  assert.equal(clearIncompatibleBuilding("org-a", "b2", buildings), "");
  assert.equal(clearIncompatibleBuilding("", "b2", buildings), "b2");
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

test("active filter summary formatting includes period and optional master-data labels", () => {
  assert.equal(
    formatActiveReportingFilterSummary({
      dateFrom: "2026-04-17",
      dateTo: "2026-07-16",
      organization: "",
      building: "",
    }),
    "Period 2026-04-17 to 2026-07-16",
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
    "Period 2026-04-17 to 2026-07-16 · Organization: Acme Facilities · Building: North Wing",
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
    canApplyReportingFilters({
      dateFrom: "2026-04-17",
      dateTo: "2026-07-16",
      organization: "",
      building: "",
    }),
    true,
  );
});
