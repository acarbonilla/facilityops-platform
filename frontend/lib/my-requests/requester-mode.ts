/**
 * Employee requester-mode detection for FO-076.
 *
 * Backend authority remains in apps.fm_tickets.tenant_scope
 * (uses_employee_requester_scope / uses_employee_requester_creation).
 *
 * Frontend limitation: /access-control/me/permissions/ returns flattened
 * role codes and permission codes, but cannot attribute fm_tickets.view to a
 * specific non-employee custom role the way the backend excludes the Employee
 * role when checking broader grants. Known operational system roles and any
 * FM Ticket permission beyond view/create are treated as operational. A later
 * backend-derived access_mode field is recommended to remove this ambiguity.
 */

export const EMPLOYEE_ROLE_CODE = "employee";

export const OPERATIONAL_FM_ROLE_CODES = [
  "system_admin",
  "facility_manager",
  "technician",
  "viewer",
] as const;

export const EMPLOYEE_FM_PERMISSION_CODES = [
  "fm_tickets.view",
  "fm_tickets.create",
] as const;

export interface EmployeeRequesterModeInput {
  roles?: readonly string[] | null;
  permissions?: readonly string[] | null;
  permissionsLoading?: boolean;
  permissionsError?: string | null | boolean;
  /** Staff alone never grants requester mode or operational bypass. */
  isStaff?: boolean;
}

function normalizeRoleCodes(roles: readonly string[] | null | undefined): string[] {
  if (!roles) {
    return [];
  }

  return roles
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

function normalizePermissionCodes(
  permissions: readonly string[] | null | undefined,
): string[] {
  if (!permissions) {
    return [];
  }

  return permissions.map((permission) => permission.trim()).filter(Boolean);
}

export function hasEmployeeRole(
  roles: readonly string[] | null | undefined,
): boolean {
  return normalizeRoleCodes(roles).includes(EMPLOYEE_ROLE_CODE);
}

export function hasOperationalFmRole(
  roles: readonly string[] | null | undefined,
): boolean {
  const normalized = new Set(normalizeRoleCodes(roles));
  return OPERATIONAL_FM_ROLE_CODES.some((code) => normalized.has(code));
}

export function hasBroaderFmTicketPermission(
  permissions: readonly string[] | null | undefined,
): boolean {
  const employeePermissions = new Set<string>(EMPLOYEE_FM_PERMISSION_CODES);
  return normalizePermissionCodes(permissions).some(
    (permission) =>
      permission.startsWith("fm_tickets.") && !employeePermissions.has(permission),
  );
}

/**
 * True only when the account should use the Employee My Requests experience.
 * Fail closed while roles/permissions are loading or unavailable.
 * Do not infer Employee from is_staff.
 */
export function isEmployeeRequesterMode(
  input: EmployeeRequesterModeInput,
): boolean {
  if (input.permissionsLoading || input.permissionsError) {
    return false;
  }

  if (!Array.isArray(input.roles)) {
    return false;
  }

  if (!hasEmployeeRole(input.roles)) {
    return false;
  }

  if (hasOperationalFmRole(input.roles)) {
    return false;
  }

  if (hasBroaderFmTicketPermission(input.permissions)) {
    return false;
  }

  return true;
}

export function shouldUseOperationalFmTicketsExperience(
  input: EmployeeRequesterModeInput,
): boolean {
  if (input.permissionsLoading || input.permissionsError) {
    return false;
  }

  if (!Array.isArray(input.roles) || !Array.isArray(input.permissions)) {
    return false;
  }

  if (isEmployeeRequesterMode(input)) {
    return false;
  }

  return normalizePermissionCodes(input.permissions).includes("fm_tickets.view");
}
