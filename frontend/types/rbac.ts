export type PermissionCode = string;

export type PermissionGuardMode = "all" | "any";

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  is_system_role: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleReference {
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

export interface RolePermissionAssignmentResponse {
  role: RoleReference;
  assigned_permissions: Permission[];
}

export interface ReplaceRolePermissionsPayload {
  permission_ids: string[];
}

export interface PermissionGroup {
  module: string;
  permissions: Permission[];
}

export interface RoleListParams {
  search?: string;
  is_active?: boolean;
  is_system_role?: boolean;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export type RbacListParams = RoleListParams;

export interface RoleListFilters {
  search: string;
  systemRole: "" | "true" | "false";
  active: "" | "true" | "false";
  ordering: string;
  pageSize: number;
}

export interface RoleCreatePayload {
  name: string;
  code: string;
  description: string;
}

export interface RoleUpdatePayload {
  name: string;
  description: string;
}

export type RoleFormMode = "create" | "edit";

export interface RoleFormValues {
  name: string;
  code: string;
  description: string;
}

export interface PermissionListParams extends RbacListParams {
  module?: string;
  action?: string;
}

export interface UserPermissionsResponse {
  roles: string[];
  permissions: PermissionCode[];
}

export interface RoleListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Role[];
}

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
