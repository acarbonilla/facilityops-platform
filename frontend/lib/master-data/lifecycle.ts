import { ApiError } from "@/services/api/types";
import type {
  BaseMasterDataRecord,
  MasterDataLifecycle,
  MasterDataListParams,
  MasterDataResourceKey,
} from "@/types/master-data";

export const MASTER_DATA_PAGE_SIZE = 25;
export const MASTER_DATA_CLIENT_SEARCH_ENABLED = false;

export type MasterDataLifecycleAction =
  | "edit"
  | "deactivate"
  | "reactivate"
  | "delete"
  | "restore";

export function getLifecycleState(
  isActive: boolean,
  isDeleted: boolean,
): MasterDataLifecycle {
  if (isDeleted) return "deleted";
  return isActive ? "active" : "inactive";
}

export function getPageAfterLifecycleChange(
  currentLifecycle: MasterDataLifecycle,
  nextLifecycle: MasterDataLifecycle,
  currentPage: number,
): number {
  return currentLifecycle === nextLifecycle ? currentPage : 1;
}

export function buildLifecycleListParams(
  lifecycle: MasterDataLifecycle,
  page: number,
): MasterDataListParams {
  const params: MasterDataListParams = {
    page: Math.max(1, Math.trunc(page) || 1),
    page_size: MASTER_DATA_PAGE_SIZE,
  };
  if (lifecycle !== "deleted") {
    params.is_active = lifecycle === "active";
  }
  return params;
}

export function getLifecycleActions(
  lifecycle: MasterDataLifecycle,
  resource: MasterDataResourceKey,
  canManage: boolean,
  canManageTenantGlobally = false,
): MasterDataLifecycleAction[] {
  if (!canManage) return [];
  if (resource === "tenants") {
    if (lifecycle === "active") {
      return canManageTenantGlobally
        ? ["edit", "deactivate", "delete"]
        : ["edit", "deactivate"];
    }
    if (lifecycle === "inactive") {
      return canManageTenantGlobally
        ? ["edit", "reactivate", "delete"]
        : ["edit"];
    }
    return canManageTenantGlobally ? ["restore"] : [];
  }
  if (lifecycle === "deleted") return ["restore"];
  if (lifecycle === "inactive") return ["edit", "reactivate", "delete"];
  return ["edit", "deactivate", "delete"];
}

export function getTotalPages(count: number): number {
  return Math.max(1, Math.ceil(Math.max(0, count) / MASTER_DATA_PAGE_SIZE));
}

export function canUseManageControls(
  hasManagePermission: boolean,
  permissionsLoading: boolean,
  permissionsError: string | null,
): boolean {
  return hasManagePermission && !permissionsLoading && !permissionsError;
}

export function shouldEnableMasterDataQuery(
  authLoading: boolean,
  isAuthenticated: boolean,
): boolean {
  return !authLoading && isAuthenticated;
}

export function getMasterDataSessionScope(
  userId: string | null | undefined,
  tenantId: string | null | undefined,
): string {
  return userId ? `${userId}:${tenantId ?? "global"}` : "anonymous";
}

export function includeCurrentInactiveOption<T extends BaseMasterDataRecord>(
  records: T[],
  currentId?: string | null,
): T[] {
  return records.filter((record) => record.is_active || record.id === currentId);
}

export function bindTenantToPayload<T extends object>(
  payload: T,
  authenticatedTenant: string | null | undefined,
): T {
  if (!authenticatedTenant || !("tenant" in payload)) return payload;
  return { ...payload, tenant: authenticatedTenant };
}

export function hasReliableGlobalTenantRole(
  globalRoleConfirmed: boolean,
  isStaff: boolean,
): boolean {
  void isStaff;
  return globalRoleConfirmed;
}

export function getTenantOptionState<T extends { id: string; name: string }>(
  records: T[],
  authenticatedTenant: string | null | undefined,
) {
  if (!authenticatedTenant) {
    return {
      records,
      locked: false,
      description: "Select the tenant that owns this record.",
    };
  }
  return {
    records: records.filter((record) => record.id === authenticatedTenant),
    locked: true,
    description:
      "Tenant is locked to your signed-in account and is enforced when saving.",
  };
}

function formatFieldLabel(field: string): string {
  const words = field.replaceAll("_", " ");
  return words[0].toUpperCase() + words.slice(1);
}

function formatFieldErrors(errors: Record<string, string[]>): string {
  return Object.entries(errors)
    .flatMap(([field, messages]) =>
      messages.map((message) =>
        field === "non_field_errors"
          ? message
          : `${formatFieldLabel(field)}: ${message}`,
      ),
    )
    .join(" ");
}

function formatHierarchyErrors(errors: Record<string, string>): string {
  return Object.entries(errors)
    .map(([field, message]) => `${formatFieldLabel(field)}: ${message}`)
    .join(" ");
}

export function formatMasterDataError(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  switch (error.status) {
    case 400:
      return error.details?.errors
        ? formatFieldErrors(error.details.errors)
        : error.details?.message ?? "Check the submitted values and try again.";
    case 401:
      return "Your session has expired. Sign in again before retrying.";
    case 403:
      return "You do not have permission to perform this master-data action.";
    case 404:
      return "This record is no longer available. Refresh the list and try again.";
    case 409:
      if (error.details?.dependencies?.length) {
        return `${error.details.message} Blocking dependencies: ${error.details.dependencies.join(", ")}.`;
      }
      if (error.details?.hierarchyErrors) {
        return `${error.details.message} ${formatHierarchyErrors(error.details.hierarchyErrors)}`;
      }
      return error.details?.message ??
        "This action conflicts with the current hierarchy or dependent records.";
    case 0:
      return "The backend service could not be reached. Check your connection and retry.";
    default:
      return error.details?.message ?? error.message ?? fallback;
  }
}

export function getMutationSuccessMessage(
  action: Exclude<MasterDataLifecycleAction, "edit">,
  entityType: string,
  recordName: string,
  recordCode: string,
): string {
  const pastTense = {
    deactivate: "deactivated",
    reactivate: "reactivated",
    delete: "soft deleted",
    restore: "restored as inactive",
  }[action];
  return `${entityType} ${recordName} (${recordCode}) was ${pastTense}.`;
}

export function getLifecycleEmptyStateMessage(
  lifecycle: MasterDataLifecycle,
  pluralLabel: string,
  hasAnyRecords: boolean,
  hasFilters: boolean,
): string {
  const label = pluralLabel.toLowerCase();
  if (!hasAnyRecords) return `No ${label} exist yet.`;
  if (hasFilters) return `No ${label} match the selected filters.`;
  if (lifecycle === "active") return `There are no active ${label}.`;
  if (lifecycle === "inactive") return `There are no inactive ${label}.`;
  return `There are no deleted ${label} available to restore.`;
}

export function getMasterDataInvalidationKeys(
  resource: MasterDataResourceKey,
  id?: string,
): readonly (readonly unknown[])[] {
  const keys: (readonly unknown[])[] = [
    ["master-data", resource],
    ["dashboard", "foundation-summary"],
    ["reporting", "overview"],
    ["reporting", "filter-options"],
    ["users", "form-options"],
    ["maintenance", "form-options"],
    ["inspection", "form-options"],
  ];
  if (id) keys.splice(1, 0, ["master-data", resource, id]);
  return keys;
}

export function getDependentFieldsToReset(
  field: "tenant" | "organization" | "building" | "floor",
): string[] {
  if (field === "tenant") {
    return ["organization", "building", "floor", "area", "asset_type"];
  }
  if (field === "organization") return ["building", "floor", "area"];
  if (field === "building") return ["floor", "area"];
  return ["area"];
}
