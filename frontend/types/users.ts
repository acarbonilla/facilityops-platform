export interface UserRecord {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  tenant: string | null;
  organization: string | null;
  is_active: boolean;
  is_staff: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserDirectoryItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  tenant: string | null;
  organization: string | null;
  is_active: boolean;
}

export interface UserCreatePayload {
  email: string;
  first_name: string;
  last_name: string;
  tenant: string | null;
  organization: string | null;
  password: string;
  is_active: boolean;
  is_staff: boolean;
}

export interface UserUpdatePayload {
  email: string;
  first_name: string;
  last_name: string;
  tenant: string | null;
  organization: string | null;
  password?: string;
  is_active: boolean;
  is_staff: boolean;
}

export interface UserListParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  search?: string;
  tenant?: string;
  organization?: string;
  is_active?: boolean;
  is_staff?: boolean;
  ordering?: string;
}

export interface UserDirectoryParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  page_size?: number;
  search?: string;
  tenant?: string;
  organization?: string;
  ordering?: string;
}

export interface UserListFilters {
  search: string;
  tenant: string;
  organization: string;
  active: "" | "true" | "false";
  staff: "" | "true" | "false";
  ordering: string;
  pageSize: number;
}

export interface UserFormValues {
  email: string;
  first_name: string;
  last_name: string;
  tenant: string;
  organization: string;
  password: string;
  confirm_password: string;
  is_active: boolean;
  is_staff: boolean;
}

export type UserFormMode = "create" | "edit";
