import type { AuthUser } from "@/types/auth";
import type { PermissionCode } from "@/types/rbac";

type PermissionAwareUser = Pick<AuthUser, "is_staff"> & {
  is_superuser?: boolean;
};

function getPermissionSet(permissions: PermissionCode[] = []): Set<PermissionCode> {
  return new Set(permissions);
}

function hasElevatedAccess(user?: PermissionAwareUser | null): boolean {
  if (!user) {
    return false;
  }

  return Boolean(user.is_staff || user.is_superuser);
}

export function hasPermission(
  permissions: PermissionCode[] = [],
  permissionCode: PermissionCode,
  user?: PermissionAwareUser | null,
): boolean {
  if (hasElevatedAccess(user)) {
    return true;
  }

  const normalizedPermission = permissionCode.trim();
  if (!normalizedPermission) {
    return false;
  }

  return getPermissionSet(permissions).has(normalizedPermission);
}

export function hasAnyPermission(
  permissions: PermissionCode[] = [],
  permissionCodes: PermissionCode[] = [],
  user?: PermissionAwareUser | null,
): boolean {
  if (hasElevatedAccess(user)) {
    return true;
  }

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
  user?: PermissionAwareUser | null,
): boolean {
  if (hasElevatedAccess(user)) {
    return true;
  }

  const requiredPermissions = permissionCodes
    .map((permissionCode) => permissionCode.trim())
    .filter(Boolean);

  if (requiredPermissions.length === 0) {
    return true;
  }

  const permissionSet = getPermissionSet(permissions);
  return requiredPermissions.every((permissionCode) => permissionSet.has(permissionCode));
}
