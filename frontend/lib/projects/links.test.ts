import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/services/api/types";
import type { ProjectOperationalLink } from "@/types/projects";

import {
  DEFAULT_PROJECT_LINK_LIST_FILTERS,
  buildProjectLinkFormDefaults,
  canManageProjectLinks,
  canOpenLinkedProject,
  canViewProjectLinks,
  filterLinksForProjectTask,
  filterProjectLinks,
  formatProjectLinkAccessibilityLabel,
  formatProjectLinkError,
  formatProjectLinkRelationshipLabel,
  formatProjectLinkTargetLabel,
  formatProjectLinkTypeLabel,
  getProjectLinkListLayoutClasses,
  getProjectLinkTargetHref,
  hasLinkedProjects,
  mapProjectLinkFormValuesToCreatePayload,
  serializeProjectLinkListParams,
  summarizeProjectLinksByType,
  validateProjectLinkFormValues,
} from "./links";

function makeLink(
  overrides: Partial<ProjectOperationalLink> = {},
): ProjectOperationalLink {
  return {
    id: "link-1",
    project_id: "proj-1",
    link_type: "fm_ticket",
    relationship: "related",
    notes: "",
    project_task_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    target_accessible: true,
    target_id: "ticket-1",
    target_number: "FM-001",
    target_title: "Leaking pipe",
    target_status: "open",
    fm_ticket_id: "ticket-1",
    ...overrides,
  };
}

test("link type and relationship labels cover FO-108 choices", () => {
  assert.equal(formatProjectLinkTypeLabel("fm_ticket"), "FM Ticket");
  assert.equal(
    formatProjectLinkTypeLabel("maintenance_work_order"),
    "Maintenance Work Order",
  );
  assert.equal(formatProjectLinkTypeLabel("inspection"), "Inspection");
  assert.equal(
    formatProjectLinkRelationshipLabel("corrective_action"),
    "Corrective Action",
  );
  assert.equal(formatProjectLinkRelationshipLabel("follow_up"), "Follow Up");
});

test("link permission helpers require links or manage codes", () => {
  const allow = (codes: string[]) => (code: string) => codes.includes(code);

  assert.equal(canViewProjectLinks(allow(["projects.links.view"])), true);
  assert.equal(canViewProjectLinks(allow(["projects.view"])), true);
  assert.equal(canViewProjectLinks(allow(["projects.create"])), false);

  assert.equal(canManageProjectLinks(allow(["projects.links.manage"])), true);
  assert.equal(canManageProjectLinks(allow(["projects.manage"])), true);
  assert.equal(canManageProjectLinks(allow(["projects.links.view"])), false);

  assert.equal(canOpenLinkedProject(allow(["projects.view"])), true);
  assert.equal(canOpenLinkedProject(allow(["fm_tickets.view"])), false);
});

test("serialize link list params uses page size from filters", () => {
  const params = serializeProjectLinkListParams(
    { ...DEFAULT_PROJECT_LINK_LIST_FILTERS, pageSize: 50 },
    2,
  );
  assert.equal(params.page, 2);
  assert.equal(params.page_size, 50);
});

test("client filters match type, relationship, accessibility, and search", () => {
  const links = [
    makeLink(),
    makeLink({
      id: "link-2",
      link_type: "inspection",
      relationship: "evidence",
      target_accessible: false,
      target_id: undefined,
      target_number: undefined,
      target_title: undefined,
    }),
  ];

  assert.equal(
    filterProjectLinks(links, {
      ...DEFAULT_PROJECT_LINK_LIST_FILTERS,
      linkType: "inspection",
    }).length,
    1,
  );
  assert.equal(
    filterProjectLinks(links, {
      ...DEFAULT_PROJECT_LINK_LIST_FILTERS,
      relationship: "related",
    }).length,
    1,
  );
  assert.equal(
    filterProjectLinks(links, {
      ...DEFAULT_PROJECT_LINK_LIST_FILTERS,
      accessibility: "restricted",
    }).length,
    1,
  );
  assert.equal(
    filterProjectLinks(
      links,
      { ...DEFAULT_PROJECT_LINK_LIST_FILTERS, search: "leaking" },
      "leaking",
    ).length,
    1,
  );
});

test("summary counts and task filter helpers", () => {
  const links = [
    makeLink({ project_task_id: "task-1" }),
    makeLink({
      id: "link-2",
      link_type: "inspection",
      project_task_id: "task-2",
    }),
    makeLink({ id: "link-3", link_type: "inspection", project_task_id: null }),
  ];

  const summary = summarizeProjectLinksByType(links);
  assert.equal(summary.find((row) => row.type === "fm_ticket")?.count, 1);
  assert.equal(summary.find((row) => row.type === "inspection")?.count, 2);

  assert.equal(filterLinksForProjectTask(links, "task-1").length, 1);
});

test("target href and restricted labels avoid color-only meaning", () => {
  const accessible = makeLink();
  assert.equal(getProjectLinkTargetHref(accessible), "/fm-tickets/ticket-1");
  assert.match(formatProjectLinkTargetLabel(accessible), /FM-001/);
  assert.equal(formatProjectLinkAccessibilityLabel(true), "Accessible");

  const restricted = makeLink({
    target_accessible: false,
    target_id: undefined,
  });
  assert.equal(getProjectLinkTargetHref(restricted), null);
  assert.equal(formatProjectLinkTargetLabel(restricted), "Restricted target");
  assert.equal(formatProjectLinkAccessibilityLabel(false), "Restricted");
});

test("create payload maps target id to typed foreign key", () => {
  const defaults = buildProjectLinkFormDefaults();
  const errors = validateProjectLinkFormValues(defaults);
  assert.equal(errors.link_type, "Link type is required.");
  assert.equal(errors.target_id, "Select a record to link.");

  const payload = mapProjectLinkFormValuesToCreatePayload({
    link_type: "maintenance_work_order",
    target_id: "wo-1",
    relationship: "execution",
    notes: "  note  ",
    project_task: "task-9",
  });
  assert.equal(payload.link_type, "maintenance_work_order");
  assert.equal(payload.maintenance_work_order, "wo-1");
  assert.equal(payload.fm_ticket, undefined);
  assert.equal(payload.notes, "note");
  assert.equal(payload.project_task, "task-9");
});

test("linked projects presence and layout helpers", () => {
  assert.equal(hasLinkedProjects(undefined), false);
  assert.equal(hasLinkedProjects([]), false);
  assert.equal(
    hasLinkedProjects([
      {
        id: "p1",
        project_code: "PRJ-1",
        name: "Roof",
        status: "planned",
        link_id: "l1",
        relationship: "related",
        link_type: "fm_ticket",
      },
    ]),
    true,
  );

  const classes = getProjectLinkListLayoutClasses();
  assert.match(classes.tableWrapper, /hidden/);
  assert.match(classes.tableWrapper, /md:block/);
  assert.match(classes.cardsWrapper, /md:hidden/);
});

test("link error formatting handles forbidden responses", () => {
  assert.match(
    formatProjectLinkError(new ApiError("forbidden", 403), "fallback"),
    /permission/i,
  );
});
