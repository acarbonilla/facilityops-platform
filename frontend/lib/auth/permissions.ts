import type { AuthUser } from "@/types/auth";
import type { PermissionCode } from "@/types/rbac";

type PermissionAwareUser = Pick<AuthUser, "is_staff">;

function getPermissionSet(permissions: PermissionCode[] = []): Set<PermissionCode> {
  return new Set(permissions);
}

export function hasPermission(
  permissions: PermissionCode[] = [],
  permissionCode: PermissionCode,
  _user?: PermissionAwareUser | null,
): boolean {
  void _user;
  const normalizedPermission = permissionCode.trim();
  if (!normalizedPermission) {
    return false;
  }

  return getPermissionSet(permissions).has(normalizedPermission);
}

export function hasAnyPermission(
  permissions: PermissionCode[] = [],
  permissionCodes: PermissionCode[] = [],
  _user?: PermissionAwareUser | null,
): boolean {
  void _user;
  const requiredPermissions = permissionCodes
    .map((permissionCode) => permissionCode.trim())
    .filter(Boolean);

  if (requiredPermissions.length === 0) {
    return true;
  }

  const permissionSet = getPermissionSet(permissions);
  return requiredPermissions.some((permissionCode) => permissionSet.has(permissionCode));
}

export function hasAllPermissions(
  permissions: PermissionCode[] = [],
  permissionCodes: PermissionCode[] = [],
  _user?: PermissionAwareUser | null,
): boolean {
  void _user;
  const requiredPermissions = permissionCodes
    .map((permissionCode) => permissionCode.trim())
    .filter(Boolean);

  if (requiredPermissions.length === 0) {
    return true;
  }

  const permissionSet = getPermissionSet(permissions);
  return requiredPermissions.every((permissionCode) => permissionSet.has(permissionCode));
}
