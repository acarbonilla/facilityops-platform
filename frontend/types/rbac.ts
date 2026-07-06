export type PermissionCode = string;

export type PermissionGuardMode = "all" | "any";

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  is_system_role: boolean;
  is_active: boolean;
}

export interface Permission {
  id: string;
  name: string;
  code: PermissionCode;
  module: string;
  action: string;
  description: string;
  is_active: boolean;
}

export interface RolePermission {
  id?: string;
  role: string | Role;
  permission: string | Permission;
  is_active: boolean;
}

export interface RoleDetailResponse extends Role {
  permissions?: Permission[];
  role_permissions?: RolePermission[];
}

export interface PermissionGroup {
  module: string;
  permissions: Permission[];
}

export interface RbacListParams {
  search?: string;
  is_active?: boolean;
}

export interface PermissionListParams extends RbacListParams {
  module?: string;
  action?: string;
}

export interface UserPermissionsResponse {
  roles: string[];
  permissions: PermissionCode[];
}

export type RoleListResponse = Role[];

export type PermissionListResponse = Permission[];

export interface NavigationItem {
  label: string;
  href: string;
  description?: string;
  requiredPermissions?: PermissionCode[];
  permissionMode?: PermissionGuardMode;
  authenticatedOnly?: boolean;
  matchStrategy?: "exact" | "prefix";
}
