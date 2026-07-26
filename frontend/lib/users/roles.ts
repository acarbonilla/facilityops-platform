import { hasPermission } from "@/lib/auth/permissions";
import type { AuthUser } from "@/types/auth";
import type {
  ReplaceUserRolesPayload,
  UserAssignedRole,
} from "@/types/users";
import type { PermissionCode } from "@/types/rbac";

export function getUserRoleSectionAccess(
  permissions: PermissionCode[],
  currentUser: AuthUser | null,
) {
  const canViewRoles =
    hasPermission(permissions, "users.view", currentUser) &&
    hasPermission(permissions, "roles.view", currentUser);

  return {
    canViewRoles,
    canManageRoles:
      canViewRoles && hasPermission(permissions, "roles.manage", currentUser),
  };
}

export function getInitialAssignedRoleIds(roles: UserAssignedRole[]): string[] {
  return roles.map((role) => role.id);
}

export function buildReplaceUserRolesPayload(
  roleIds: string[],
): ReplaceUserRolesPayload {
  const uniqueRoleIds = Array.from(
    new Set(roleIds.map((roleId) => roleId.trim()).filter(Boolean)),
  );
  return { role_ids: uniqueRoleIds };
}

export function filterVisibleAssignableRoles(
  roles: UserAssignedRole[],
  currentUser: AuthUser | null,
  activeRoleCodes: string[] = [],
) {
  // Tenant-bound System Administrators may assign system roles returned by
  // the backend. Other tenant-bound actors only see non-system roles.
  const canAssignSystemRoles =
    !currentUser?.tenant ||
    activeRoleCodes.some(
      (code) => code.trim().toLowerCase() === "system_admin",
    );
  if (canAssignSystemRoles) {
    return roles;
  }
  return roles.filter((role) => !role.is_system_role);
}

export function getTenantScopedOrganizations<
  T extends { id: string; tenant: string },
>(organizations: T[], currentUserTenant: string | null | undefined): T[] {
  if (!currentUserTenant) {
    return organizations;
  }
  return organizations.filter((item) => item.tenant === currentUserTenant);
}

export function shouldShowUserTenantFilter(
  currentUserTenant: string | null | undefined,
): boolean {
  // Tenant-bound administrators cannot broaden User Management by tenant filter.
  return !currentUserTenant;
}