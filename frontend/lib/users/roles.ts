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
) {
  if (currentUser?.tenant) {
    return roles.filter((role) => !role.is_system_role);
  }
  return roles;
}