import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/services/api/types";
import type { NavigationItem } from "@/types/rbac";
import {
  MY_REQUEST_ATTACHMENT_GUIDANCE,
  type MyRequestDetail,
  type MyRequestFormValues,
} from "@/types/my-requests";

import {
  formatMyRequestOptionsError,
  formatRequesterCategoryLabel,
  formatRequesterStatusLabel,
  getAttachmentGuidanceText,
  getGenericMyRequestNotFoundMessage,
  getSafeMyRequestDetailFieldNames,
  isGenericMyRequestNotFound,
  mapMyRequestFieldValidationErrors,
  mapSafeMyRequestDetailFields,
  myRequestsRequiresSettingsView,
} from "./display";
import {
  applyAreaChange,
  applyBuildingChange,
  applyFloorChange,
  buildMyRequestCreatePayload,
  filterCompatibleAssets,
  isAssetCompatibleWithSelection,
  normalizeMyRequestFilters,
  normalizeMyRequestListParams,
} from "./form";
import {
  filterNavigationForEmployeeRequester,
  MY_REQUESTS_NAV_ITEM,
  shouldShowMyRequestsNav,
  shouldShowOperationalFmTicketsNav,
} from "./navigation";
import { myRequestsQueryKeys } from "./query-keys";
import {
  hasBroaderFmTicketPermission,
  isEmployeeRequesterMode,
  shouldUseOperationalFmTicketsExperience,
} from "./requester-mode";
import {
  classifyFmTicketPathname,
  resolveEmployeeFmTicketRedirect,
} from "./routes";

const READY = {
  permissionsLoading: false,
  permissionsError: null as string | null,
};

test("1. Employee-only requester-mode detection", () => {
  assert.equal(
    isEmployeeRequesterMode({
      ...READY,
      roles: ["employee"],
      permissions: ["fm_tickets.view", "fm_tickets.create"],
    }),
    true,
  );
});

test("2. Employee + Facility Manager remains operational", () => {
  assert.equal(
    isEmployeeRequesterMode({
      ...READY,
      roles: ["employee", "facility_manager"],
      permissions: ["fm_tickets.view", "fm_tickets.create", "fm_tickets.update"],
    }),
    false,
  );
  assert.equal(
    shouldUseOperationalFmTicketsExperience({
      ...READY,
      roles: ["employee", "facility_manager"],
      permissions: ["fm_tickets.view", "fm_tickets.create", "fm_tickets.update"],
    }),
    true,
  );
});

test("3. Employee + Technician remains operational", () => {
  assert.equal(
    isEmployeeRequesterMode({
      ...READY,
      roles: ["employee", "technician"],
      permissions: ["fm_tickets.view", "fm_tickets.update"],
    }),
    false,
  );
});

test("4. Employee + Viewer remains operational", () => {
  assert.equal(
    isEmployeeRequesterMode({
      ...READY,
      roles: ["employee", "viewer"],
      permissions: ["fm_tickets.view"],
    }),
    false,
  );
});

test("5. system_admin remains operational", () => {
  assert.equal(
    isEmployeeRequesterMode({
      ...READY,
      roles: ["system_admin"],
      permissions: ["fm_tickets.view", "fm_tickets.manage"],
    }),
    false,
  );
  assert.equal(
    isEmployeeRequesterMode({
      ...READY,
      roles: ["employee", "system_admin"],
      permissions: ["fm_tickets.view", "fm_tickets.manage"],
    }),
    false,
  );
});

test("6. Staff alone provides no access bypass", () => {
  assert.equal(
    isEmployeeRequesterMode({
      ...READY,
      roles: [],
      permissions: [],
      isStaff: true,
    }),
    false,
  );
  assert.equal(
    isEmployeeRequesterMode({
      ...READY,
      roles: ["employee"],
      permissions: ["fm_tickets.view", "fm_tickets.create"],
      isStaff: true,
    }),
    true,
  );
});

test("7. Fail-closed loading/error role state", () => {
  assert.equal(
    isEmployeeRequesterMode({
      roles: ["employee"],
      permissions: ["fm_tickets.view"],
      permissionsLoading: true,
      permissionsError: null,
    }),
    false,
  );
  assert.equal(
    isEmployeeRequesterMode({
      roles: ["employee"],
      permissions: ["fm_tickets.view"],
      permissionsLoading: false,
      permissionsError: "failed",
    }),
    false,
  );
  assert.equal(
    isEmployeeRequesterMode({
      roles: null,
      permissions: ["fm_tickets.view"],
      ...READY,
    }),
    false,
  );
});

test("8. My Requests navigation visibility", () => {
  assert.equal(
    shouldShowMyRequestsNav({
      ...READY,
      roles: ["employee"],
      permissions: ["fm_tickets.view", "fm_tickets.create"],
    }),
    true,
  );
  assert.equal(
    shouldShowMyRequestsNav({
      ...READY,
      roles: ["facility_manager"],
      permissions: ["fm_tickets.view"],
    }),
    false,
  );
});

test("9. Operational navigation preserved for broader roles", () => {
  const items: NavigationItem[] = [
    { label: "Dashboard", href: "/dashboard", authenticatedOnly: true },
    {
      label: "FM Ticketing",
      href: "/fm-tickets",
      authenticatedOnly: true,
      requiredPermissions: ["fm_tickets.view"],
    },
    MY_REQUESTS_NAV_ITEM,
    {
      label: "Maintenance",
      href: "/maintenance",
      authenticatedOnly: true,
      requiredPermissions: ["maintenance.view"],
    },
  ];

  const operational = filterNavigationForEmployeeRequester(items, {
    ...READY,
    roles: ["facility_manager"],
    permissions: ["fm_tickets.view", "maintenance.view"],
    isAuthenticated: true,
    hasPermission: (code) =>
      ["fm_tickets.view", "maintenance.view"].includes(code),
    hasAnyPermission: (codes) =>
      codes.some((code) =>
        ["fm_tickets.view", "maintenance.view"].includes(code),
      ),
  });

  assert.deepEqual(
    operational.map((item) => item.href),
    ["/dashboard", "/fm-tickets", "/maintenance"],
  );
  assert.equal(
    shouldShowOperationalFmTicketsNav({
      ...READY,
      roles: ["facility_manager"],
      permissions: ["fm_tickets.view"],
      hasFmTicketsView: true,
    }),
    true,
  );

  const employeeOnly = filterNavigationForEmployeeRequester(items, {
    ...READY,
    roles: ["employee"],
    permissions: ["fm_tickets.view", "fm_tickets.create"],
    isAuthenticated: true,
    hasPermission: (code) =>
      ["fm_tickets.view", "fm_tickets.create"].includes(code),
    hasAnyPermission: (codes) =>
      codes.some((code) =>
        ["fm_tickets.view", "fm_tickets.create"].includes(code),
      ),
  });

  assert.deepEqual(
    employeeOnly.map((item) => item.href),
    ["/dashboard", "/my-requests"],
  );
});

test("10. Route classification and safe redirects", () => {
  assert.equal(classifyFmTicketPathname("/fm-tickets"), "list");
  assert.equal(classifyFmTicketPathname("/fm-tickets/new"), "create");
  assert.equal(
    classifyFmTicketPathname("/fm-tickets/11111111-1111-4111-8111-111111111111"),
    "detail",
  );
  assert.equal(
    classifyFmTicketPathname(
      "/fm-tickets/11111111-1111-4111-8111-111111111111/edit",
    ),
    "edit",
  );
  assert.equal(
    resolveEmployeeFmTicketRedirect("/fm-tickets", true),
    "/my-requests",
  );
  assert.equal(
    resolveEmployeeFmTicketRedirect("/fm-tickets/new", true),
    "/my-requests/new",
  );
  assert.equal(
    resolveEmployeeFmTicketRedirect(
      "/fm-tickets/11111111-1111-4111-8111-111111111111",
      true,
    ),
    "/my-requests/11111111-1111-4111-8111-111111111111",
  );
  assert.equal(
    resolveEmployeeFmTicketRedirect("/fm-tickets", false),
    null,
  );
});

test("11. Query-key stability and session separation", () => {
  assert.deepEqual(myRequestsQueryKeys.myRequests(), ["my-requests"]);
  assert.deepEqual(myRequestsQueryKeys.myRequestOptions(), [
    "my-requests",
    "options",
  ]);
  assert.deepEqual(
    myRequestsQueryKeys.myRequestDetail("abc"),
    ["my-requests", "detail", "abc"],
  );
  assert.notDeepEqual(
    myRequestsQueryKeys.myRequestList({ status: "open" }, "user-a"),
    myRequestsQueryKeys.myRequestList({ status: "open" }, "user-b"),
  );
  assert.deepEqual(
    myRequestsQueryKeys.myRequestList({ status: "open", page: 1 }),
    myRequestsQueryKeys.myRequestList({ page: 1, status: "open" }),
  );
});

test("12. List-filter normalization", () => {
  assert.deepEqual(
    normalizeMyRequestFilters({ status: "open", category: "hvac" }),
    { status: "open", category: "hvac" },
  );
  assert.deepEqual(
    normalizeMyRequestFilters({ status: "", category: "" }),
    {},
  );
  assert.deepEqual(
    normalizeMyRequestListParams({
      page: 2,
      page_size: 20,
      status: "open",
      category: undefined,
    }),
    { page: 2, page_size: 20, status: "open" },
  );
});

test("13. Request payload includes only approved fields", () => {
  const values: MyRequestFormValues = {
    title: " Leak ",
    description: " Water near sink ",
    category: "plumbing",
    building: "b1",
    floor: "f1",
    area: "",
    asset: "a1",
  };
  assert.deepEqual(buildMyRequestCreatePayload(values), {
    title: "Leak",
    description: "Water near sink",
    category: "plumbing",
    building: "b1",
    floor: "f1",
    asset: "a1",
  });
  assert.equal(
    buildMyRequestCreatePayload({ ...values, title: "" }),
    null,
  );
});

test("14. Cascading Building reset", () => {
  const next = applyBuildingChange(
    {
      title: "t",
      description: "d",
      category: "hvac",
      building: "b1",
      floor: "f1",
      area: "ar1",
      asset: "as1",
    },
    "b2",
  );
  assert.deepEqual(next, {
    title: "t",
    description: "d",
    category: "hvac",
    building: "b2",
    floor: "",
    area: "",
    asset: "",
  });
});

test("15. Cascading Floor reset", () => {
  const next = applyFloorChange(
    {
      title: "t",
      description: "d",
      category: "hvac",
      building: "b1",
      floor: "f1",
      area: "ar1",
      asset: "as1",
    },
    "f2",
  );
  assert.equal(next.floor, "f2");
  assert.equal(next.area, "");
  assert.equal(next.asset, "");
  assert.equal(next.building, "b1");
});

test("16. Cascading Area reset", () => {
  const next = applyAreaChange(
    {
      title: "t",
      description: "d",
      category: "hvac",
      building: "b1",
      floor: "f1",
      area: "ar1",
      asset: "as1",
    },
    "ar2",
  );
  assert.equal(next.area, "ar2");
  assert.equal(next.asset, "");
});

test("17. Asset compatibility", () => {
  const asset = {
    id: "as1",
    name: "AHU-1",
    building_id: "b1",
    floor_id: "f1",
    area_id: "ar1",
  };
  assert.equal(
    isAssetCompatibleWithSelection(asset, {
      building: "b1",
      floor: "f1",
      area: "ar1",
    }),
    true,
  );
  assert.equal(
    isAssetCompatibleWithSelection(asset, {
      building: "b1",
      floor: "f2",
      area: "",
    }),
    false,
  );
  assert.deepEqual(
    filterCompatibleAssets(
      [
        asset,
        {
          id: "as2",
          name: "Pump",
          building_id: "b2",
          floor_id: null,
          area_id: null,
        },
      ],
      { building: "b1", floor: "", area: "" },
    ).map((item) => item.id),
    ["as1"],
  );
});

test("18. Status/category formatting", () => {
  assert.equal(formatRequesterStatusLabel("open"), "Submitted");
  assert.equal(formatRequesterStatusLabel("in_progress"), "In progress");
  assert.equal(formatRequesterCategoryLabel("hvac"), "HVAC");
  assert.equal(formatRequesterCategoryLabel("electrical"), "Electrical");
});

test("19. Request-options error formatting", () => {
  assert.match(
    formatMyRequestOptionsError(new ApiError("x", 0)),
    /connection|reached/i,
  );
  assert.match(
    formatMyRequestOptionsError(new ApiError("x", 403)),
    /permission/i,
  );
});

test("20. Field-validation error mapping", () => {
  const mapped = mapMyRequestFieldValidationErrors(
    new ApiError("validation", 400, {
      message: "Invalid",
      errors: {
        title: ["This field is required."],
        building: ["Select a building."],
      },
    }),
  );
  assert.deepEqual(mapped, {
    title: "This field is required.",
    building: "Select a building.",
  });
});

test("21. Generic not-found behavior", () => {
  const error = new ApiError("missing", 404);
  assert.equal(isGenericMyRequestNotFound(error), true);
  assert.equal(
    getGenericMyRequestNotFoundMessage(),
    "This request could not be found.",
  );
});

test("22. Safe detail-field mapping", () => {
  const detail: MyRequestDetail = {
    id: "1",
    ticket_number: "REQ-1",
    organization: "o1",
    organization_name: "Org",
    building: "b1",
    building_name: "HQ",
    floor: null,
    floor_name: null,
    area: null,
    area_name: null,
    asset: null,
    asset_name: null,
    title: "Leak",
    category: "plumbing",
    priority: "medium",
    status: "open",
    reported_at: "2026-01-01T00:00:00Z",
    description: "Water",
    resolved_at: null,
    closed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
  const mapped = mapSafeMyRequestDetailFields(detail);
  assert.equal(mapped.ticket_number, "REQ-1");
  assert.equal(mapped.title, "Leak");
  assert.ok(!("requester_email" in mapped));
  assert.ok(!("assignee_email" in mapped));
  assert.ok(!getSafeMyRequestDetailFieldNames().includes("sla"));
});

test("23. Attachment guidance text", () => {
  assert.equal(getAttachmentGuidanceText(), MY_REQUEST_ATTACHMENT_GUIDANCE);
  assert.match(getAttachmentGuidanceText(), /later update/i);
});

test("24. No settings permission requirement", () => {
  assert.equal(myRequestsRequiresSettingsView(), false);
  assert.equal(
    hasBroaderFmTicketPermission(["fm_tickets.view", "fm_tickets.create"]),
    false,
  );
  assert.equal(
    hasBroaderFmTicketPermission([
      "fm_tickets.view",
      "fm_tickets.create",
      "fm_tickets.update",
    ]),
    true,
  );
});
