import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLifecycleListParams,
  bindTenantToPayload,
  canCreateMasterDataResource,
  canUseManageControls,
  collectPaginatedMasterData,
  formatMasterDataError,
  getDependentFieldsToReset,
  getLifecycleEmptyStateMessage,
  getLifecycleActions,
  getLifecycleState,
  getMasterDataInvalidationKeys,
  getMasterDataSessionScope,
  getMutationSuccessMessage,
  getPageAfterLifecycleChange,
  getTenantOptionState,
  getTotalPages,
  hasReliableGlobalTenantRole,
  includeCurrentInactiveOption,
  MASTER_DATA_CLIENT_SEARCH_ENABLED,
  MASTER_DATA_PAGE_SIZE,
  shouldEnableMasterDataQuery,
} from "./lifecycle";
import { ApiError } from "@/services/api/types";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { masterDataQueryKeys } from "@/services/api/query-keys";
import { normalizeErrorResponse } from "@/services/api/client";
import { getFormFieldAccessibilityProps } from "@/components/common/form-field";

test("builds stable server pagination for every lifecycle", () => {
  assert.deepEqual(buildLifecycleListParams("active", 2), {
    page: 2,
    page_size: MASTER_DATA_PAGE_SIZE,
    is_active: true,
  });
  assert.deepEqual(buildLifecycleListParams("inactive", 3), {
    page: 3,
    page_size: MASTER_DATA_PAGE_SIZE,
    is_active: false,
  });
  assert.deepEqual(buildLifecycleListParams("deleted", 4), {
    page: 4,
    page_size: MASTER_DATA_PAGE_SIZE,
  });
  assert.equal(buildLifecycleListParams("active", -2).page, 1);
  assert.equal(getTotalPages(0), 1);
  assert.equal(getTotalPages(MASTER_DATA_PAGE_SIZE + 1), 2);
});

test("collects every API page for complete hierarchy options", async () => {
  const requestedPages: number[] = [];
  const results = await collectPaginatedMasterData(async (params) => {
    requestedPages.push(params.page ?? 0);
    return {
      results: [`page-${params.page}`],
      next: params.page === 1 ? "/next/" : null,
    };
  });

  assert.deepEqual(requestedPages, [1, 2]);
  assert.deepEqual(results, ["page-1", "page-2"]);
});

test("maps record flags to canonical lifecycle states", () => {
  assert.equal(getLifecycleState(true, false), "active");
  assert.equal(getLifecycleState(false, false), "inactive");
  assert.equal(getLifecycleState(false, true), "deleted");
  assert.equal(getLifecycleState(true, true), "deleted");
});

test("resets page only when lifecycle changes", () => {
  assert.equal(getPageAfterLifecycleChange("active", "inactive", 4), 1);
  assert.equal(getPageAfterLifecycleChange("deleted", "deleted", 3), 3);
});

test("deleted and restore endpoints and lifecycle query keys stay stable", () => {
  const params = buildLifecycleListParams("deleted", 2);
  assert.equal(
    API_ENDPOINTS.masterData.deleted("asset-types"),
    "/master-data/asset-types/deleted/",
  );
  assert.equal(
    API_ENDPOINTS.masterData.restore("assets", "asset-1"),
    "/master-data/assets/asset-1/restore/",
  );
  assert.deepEqual(
    masterDataQueryKeys.lifecycleList("assets", "deleted", params, "user:tenant"),
    ["master-data", "assets", "lifecycle", "deleted", params, "user:tenant"],
  );
  assert.deepEqual(
    masterDataQueryKeys.lifecycleList("assets", "deleted", { ...params }, "user:tenant"),
    masterDataQueryKeys.lifecycleList("assets", "deleted", params, "user:tenant"),
  );
  assert.deepEqual(masterDataQueryKeys.options("assets", "user:tenant"), [
    "master-data",
    "assets",
    "options",
    "user:tenant",
  ]);
});

test("scopes Master Data caches to the authenticated user and tenant", () => {
  assert.equal(getMasterDataSessionScope("user", "tenant"), "user:tenant");
  assert.equal(getMasterDataSessionScope("admin", null), "admin:global");
  assert.equal(getMasterDataSessionScope(null, null), "anonymous");
});

test("maps lifecycle actions and keeps tenant global actions hidden", () => {
  assert.deepEqual(getLifecycleActions("active", "assets", true), [
    "edit",
    "deactivate",
    "delete",
  ]);
  assert.deepEqual(getLifecycleActions("inactive", "assets", true), [
    "edit",
    "reactivate",
    "delete",
  ]);
  assert.deepEqual(getLifecycleActions("deleted", "assets", true), ["restore"]);
  assert.deepEqual(getLifecycleActions("active", "assets", false), []);
  assert.deepEqual(getLifecycleActions("active", "tenants", true), [
    "edit",
    "deactivate",
  ]);
  assert.deepEqual(getLifecycleActions("inactive", "tenants", true), ["edit"]);
  assert.deepEqual(getLifecycleActions("deleted", "tenants", true), []);
  assert.deepEqual(getLifecycleActions("deleted", "tenants", true, true), [
    "restore",
  ]);
  assert.equal(canCreateMasterDataResource("organizations", true), true);
  assert.equal(canCreateMasterDataResource("tenants", true), false);
  assert.equal(canCreateMasterDataResource("tenants", true, true), true);
});

test("manage controls and authenticated queries fail closed", () => {
  assert.equal(canUseManageControls(true, false, null), true);
  assert.equal(canUseManageControls(true, true, null), false);
  assert.equal(canUseManageControls(true, false, "failed"), false);
  assert.equal(canUseManageControls(false, false, null), false);
  assert.equal(shouldEnableMasterDataQuery(true, true), false);
  assert.equal(shouldEnableMasterDataQuery(false, false), false);
  assert.equal(shouldEnableMasterDataQuery(false, true), true);
});

test("associates Master Data controls with descriptions and field errors", () => {
  assert.deepEqual(
    getFormFieldAccessibilityProps(
      "organization",
      "Choose an organization.",
      "Organization is required.",
    ),
    {
      "aria-describedby": "organization-description organization-error",
      "aria-invalid": true,
    },
  );
  assert.deepEqual(getFormFieldAccessibilityProps("code"), {
    "aria-describedby": undefined,
    "aria-invalid": undefined,
  });
});

test("preserves only the current inactive option while editing", () => {
  const records = [
    { id: "active", name: "Active", code: "A", description: "", is_active: true },
    { id: "current", name: "Current", code: "C", description: "", is_active: false },
    { id: "other", name: "Other", code: "O", description: "", is_active: false },
  ];
  assert.deepEqual(
    includeCurrentInactiveOption(records, "current").map(({ id }) => id),
    ["active", "current"],
  );
  assert.deepEqual(
    includeCurrentInactiveOption(records).map(({ id }) => id),
    ["active"],
  );
});

test("tenant-bound payloads cannot override the authenticated tenant", () => {
  assert.deepEqual(
    bindTenantToPayload({ tenant: "other", name: "Area" }, "own"),
    { tenant: "own", name: "Area" },
  );
  assert.deepEqual(
    bindTenantToPayload({ tenant: "global", name: "Area" }, null),
    { tenant: "global", name: "Area" },
  );
  assert.deepEqual(bindTenantToPayload({ name: "Tenant" }, "own"), {
    name: "Tenant",
  });
});

test("tenant options lock with explanatory copy for tenant-bound sessions", () => {
  const tenants = [
    { id: "own", name: "Own" },
    { id: "other", name: "Other" },
  ];
  assert.deepEqual(getTenantOptionState(tenants, "own"), {
    records: [tenants[0]],
    locked: true,
    description:
      "Tenant is locked to your signed-in account and is enforced when saving.",
  });
  assert.deepEqual(getTenantOptionState(tenants, null), {
    records: tenants,
    locked: false,
    description: "Select the tenant that owns this record.",
  });
});

test("Tenant global controls require explicit reliable evidence", () => {
  assert.equal(hasReliableGlobalTenantRole(false, true), false);
  assert.equal(hasReliableGlobalTenantRole(false, false), false);
  assert.equal(hasReliableGlobalTenantRole(true, false), true);
});

test("formats safe lifecycle errors without exposing unknown payloads", () => {
  assert.match(formatMasterDataError(new ApiError("x", 401), "fallback"), /expired/);
  assert.match(formatMasterDataError(new ApiError("x", 403), "fallback"), /permission/);
  assert.match(formatMasterDataError(new ApiError("x", 404), "fallback"), /no longer/);
  assert.match(formatMasterDataError(new ApiError("x", 409), "fallback"), /hierarchy/);
  assert.match(formatMasterDataError(new ApiError("x", 400), "fallback"), /submitted/);
  assert.match(formatMasterDataError(new ApiError("x", 0), "fallback"), /connection/);
  assert.equal(
    formatMasterDataError(
      new ApiError("conflict", 409, { message: "Active Assets block this action." }),
      "fallback",
    ),
    "Active Assets block this action.",
  );
  assert.equal(formatMasterDataError({}, "fallback"), "fallback");
});

test("formats dependency and hierarchy conflicts with readable labels", () => {
  assert.equal(
    formatMasterDataError(
      new ApiError("conflict", 409, {
        message: "Cannot delete this building; dependent records exist.",
        dependencies: ["Floors", "Areas", "Assets"],
      }),
      "fallback",
    ),
    "Cannot delete this building; dependent records exist. Blocking dependencies: Floors, Areas, Assets.",
  );
  assert.equal(
    formatMasterDataError(
      new ApiError("conflict", 409, {
        message: "The record cannot be restored with its current hierarchy.",
        hierarchyErrors: {
          asset_type: "Parent is inactive.",
          building: "Building must belong to the selected organization.",
        },
      }),
      "fallback",
    ),
    "The record cannot be restored with its current hierarchy. Asset type: Parent is inactive. Building: Building must belong to the selected organization.",
  );
});

test("client normalization preserves lifecycle conflict details", () => {
  assert.deepEqual(
    normalizeErrorResponse({
      detail: "Cannot deactivate this building; dependent records exist.",
      dependencies: ["Floors", "Assets"],
    }),
    {
      message: "Cannot deactivate this building; dependent records exist.",
      dependencies: ["Floors", "Assets"],
    },
  );
  assert.deepEqual(
    normalizeErrorResponse({
      detail: "The record cannot be restored with its current hierarchy.",
      errors: { asset_type: "Parent is inactive." },
    }),
    {
      message: "The record cannot be restored with its current hierarchy.",
      hierarchyErrors: { asset_type: "Parent is inactive." },
    },
  );
});

test("formats 400 validation fields without raw JSON", () => {
  assert.equal(
    formatMasterDataError(
      new ApiError("validation", 400, {
        message: "Invalid input.",
        errors: {
          name: ["This field is required."],
          asset_type: ["Inactive records cannot be used."],
          non_field_errors: ["The hierarchy is inconsistent."],
        },
      }),
      "fallback",
    ),
    "Name: This field is required. Asset type: Inactive records cannot be used. The hierarchy is inconsistent.",
  );
  assert.deepEqual(
    normalizeErrorResponse({
      message: "Invalid input.",
      errors: { code: ["This field must be unique."] },
    }),
    {
      message: "Invalid input.",
      errors: { code: ["This field must be unique."] },
    },
  );
});

test("builds deterministic lifecycle mutation success messages", () => {
  assert.equal(
    getMutationSuccessMessage("deactivate", "Building", "North Tower", "BLD-1"),
    "Building North Tower (BLD-1) was deactivated.",
  );
  assert.equal(
    getMutationSuccessMessage("reactivate", "Asset", "Pump", "A-1"),
    "Asset Pump (A-1) was reactivated.",
  );
  assert.equal(
    getMutationSuccessMessage("delete", "Area", "Plant Room", "AR-1"),
    "Area Plant Room (AR-1) was soft deleted.",
  );
  assert.equal(
    getMutationSuccessMessage("restore", "Floor", "Ground", "F-0"),
    "Floor Ground (F-0) was restored as inactive.",
  );
});

test("returns lifecycle, no-record, and no-filter-match empty copy", () => {
  assert.equal(
    getLifecycleEmptyStateMessage("active", "Assets", true, false),
    "There are no active assets.",
  );
  assert.equal(
    getLifecycleEmptyStateMessage("inactive", "Assets", true, false),
    "There are no inactive assets.",
  );
  assert.equal(
    getLifecycleEmptyStateMessage("deleted", "Assets", true, false),
    "There are no deleted assets available to restore.",
  );
  assert.equal(
    getLifecycleEmptyStateMessage("active", "Assets", false, false),
    "No assets exist yet.",
  );
  assert.equal(
    getLifecycleEmptyStateMessage("active", "Assets", true, true),
    "No assets match the selected filters.",
  );
});

test("canonical lists explicitly omit client-side paginated search", () => {
  assert.equal(MASTER_DATA_CLIENT_SEARCH_ENABLED, false);
});

test("returns precise cross-feature invalidation prefixes", () => {
  assert.deepEqual(getMasterDataInvalidationKeys("buildings", "building-1"), [
    ["master-data", "buildings"],
    ["master-data", "buildings", "building-1"],
    ["dashboard", "foundation-summary"],
    ["reporting", "overview"],
    ["reporting", "filter-options"],
    ["users", "form-options"],
    ["fm-tickets"],
    ["maintenance", "form-options"],
    ["inspection", "form-options"],
  ]);
});

test("resets every dependent selector after hierarchy changes", () => {
  assert.deepEqual(getDependentFieldsToReset("tenant"), [
    "organization",
    "building",
    "floor",
    "area",
    "asset_type",
  ]);
  assert.deepEqual(getDependentFieldsToReset("organization"), [
    "building",
    "floor",
    "area",
  ]);
  assert.deepEqual(getDependentFieldsToReset("building"), ["floor", "area"]);
  assert.deepEqual(getDependentFieldsToReset("floor"), ["area"]);
});
