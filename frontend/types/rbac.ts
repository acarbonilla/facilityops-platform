export type PermissionCode = string;

export type PermissionGuardMode = "all" | "any";

export interface UserPermissionsResponse {
  roles: string[];
  permissions: PermissionCode[];
}

export interface NavigationItem {
  label: string;
  href: string;
  description?: string;
  requiredPermissions?: PermissionCode[];
  permissionMode?: PermissionGuardMode;
  authenticatedOnly?: boolean;
}
