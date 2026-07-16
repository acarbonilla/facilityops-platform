import assert from "node:assert/strict";
import test from "node:test";

import {
  hydrateInspectionListFilters,
  hydrateMaintenanceListFilters,
  hydrateTicketListFilters,
  isReportingReturnParam,
  type TicketListHydrationFilters,
} from "./list-hydration";
import type { InspectionListFilters } from "@/types/inspection";
import type { MaintenanceListFilters } from "@/types/maintenance";

const TICKET: TicketListHydrationFilters = {
  search: "",
  status: "",
  priority: "",
  category: "",
  organization: "",
  building: "",
  assignee: "",
};
const WORK_ORDER: MaintenanceListFilters = {
  search: "",
  status: "",
  priority: "",
  department: "",
  organization: "",
  building: "",
  floor: "",
  area: "",
  assigneeEmail: "",
  requesterEmail: "",
  overdue: false,
  slaStatus: "",
  hasActiveEscalation: false,
  hasAttachments: false,
  createdFrom: "",
  createdTo: "",
  sort: "-updated",
  pageSize: 20,
};
const INSPECTION: InspectionListFilters = {
  search: "",
  status: "",
  priority: "",
  fiveSCategory: "",
  inspectionType: "",
  department: "",
  organization: "",
  building: "",
  floor: "",
  area: "",
  sort: "-updated",
  pageSize: 20,
};
const ORG = "11111111-1111-4111-8111-111111111111";
const BUILDING = "22222222-2222-4222-8222-222222222222";

test("ticket list hydrates supported URL parameters", () => {
  const result = hydrateTicketListFilters(
    { status: "assigned", priority: "high", organization: ORG, building: BUILDING },
    TICKET,
  );
  assert.equal(result.status, "assigned");
  assert.equal(result.priority, "high");
  assert.equal(result.organization, ORG);
  assert.equal(result.building, BUILDING);
});

test("ticket invalid URL values fail safely", () => {
  assert.deepEqual(
    hydrateTicketListFilters(
      { status: "bad", priority: "bad", organization: "bad", building: "bad" },
      TICKET,
    ),
    TICKET,
  );
});

test("work order list hydrates supported URL parameters", () => {
  const result = hydrateMaintenanceListFilters(
    new URLSearchParams({
      status: "in_progress",
      priority: "critical",
      organization: ORG,
      building: BUILDING,
      created_from: "2026-04-17",
      created_to: "2026-07-16",
    }),
    WORK_ORDER,
  );
  assert.equal(result.status, "in_progress");
  assert.equal(result.priority, "critical");
  assert.equal(result.createdFrom, "2026-04-17");
  assert.equal(result.createdTo, "2026-07-16");
});

test("work order invalid URL values fail safely", () => {
  assert.deepEqual(
    hydrateMaintenanceListFilters(
      { status: "bad", priority: "bad", created_from: "bad" },
      WORK_ORDER,
    ),
    WORK_ORDER,
  );
});

test("inspection list hydrates supported URL parameters", () => {
  const result = hydrateInspectionListFilters(
    { status: "scheduled", organization: ORG, building: BUILDING },
    INSPECTION,
  );
  assert.equal(result.status, "scheduled");
  assert.equal(result.organization, ORG);
  assert.equal(result.building, BUILDING);
});

test("inspection invalid URL values fail safely", () => {
  assert.deepEqual(
    hydrateInspectionListFilters(
      { status: "bad", organization: "bad", building: "bad" },
      INSPECTION,
    ),
    INSPECTION,
  );
});

test("from=reporting marker is detected safely", () => {
  assert.equal(isReportingReturnParam({ from: "reporting" }), true);
  assert.equal(isReportingReturnParam({ from: "other" }), false);
  assert.equal(isReportingReturnParam(new URLSearchParams("from=reporting")), true);
});
