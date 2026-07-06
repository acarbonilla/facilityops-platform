export interface ManagedUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  date_joined?: string;
  created_at?: string;
  updated_at?: string;
}

export type UserListResponse = ManagedUser[];

export type UserDetailResponse = ManagedUser;

export interface UserListParams {
  search?: string;
  is_active?: boolean;
  is_staff?: boolean;
}

export interface UserManagementEndpointDiscovery {
  list: string | null;
  detail: string | null;
  create: string | null;
  update: string | null;
  userRoles: string | null;
  assignRole: string | null;
  removeRole: string | null;
}

export interface UserManagementCapabilities {
  list: boolean;
  detail: boolean;
  create: boolean;
  update: boolean;
  userRoles: boolean;
  assignRole: boolean;
  removeRole: boolean;
}
