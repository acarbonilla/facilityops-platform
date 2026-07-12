import { hasPermission } from "@/lib/auth/permissions";
import type { AuthUser } from "@/types/auth";
import type {
  DuplicateRoleDefaults,
  DuplicateRolePayload,
  PermissionCode,
  Role,
  RoleCreatePayload,
  RoleFormValues,
  RoleUpdatePayload,
} from "@/types/rbac";

export function normalizeRoleCode(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-");
}

export function buildRoleFormDefaults(role?: Role | null): RoleFormValues {
  return {
    name: role?.name ?? "",
    code: role?.code ?? "",
    description: role?.description ?? "",
  };
}

export function mapRoleCreatePayload(
  values: RoleFormValues,
): RoleCreatePayload {
  return {
    name: values.name.trim(),
    code: normalizeRoleCode(values.code),
    description: values.description.trim(),
  };
}

export function mapRoleUpdatePayload(
  values: RoleFormValues,
): RoleUpdatePayload {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
  };
}

export function buildDuplicateRoleDefaults(role: Role): DuplicateRoleDefaults {
  return {
    name: `${role.name} Copy`,
    code: normalizeRoleCode(`${role.code}-copy`),
    description: role.description,
  };
}

export function mapDuplicateRolePayload(
  values: RoleFormValues,
): DuplicateRolePayload {
  return {
    name: values.name.trim(),
    code: normalizeRoleCode(values.code),
    description: values.description.trim(),
  };
}

export function getRoleActionPermissions(
  permissions: PermissionCode[],
  currentUser: AuthUser | null,
  role?: Pick<Role, "is_system_role" | "is_active"> | null,
) {
  const canManage = hasPermission(permissions, "roles.manage", currentUser);
  const mutableRole = Boolean(
    role && !role.is_system_role && role.is_active,
  );
  return {
    canCreate: canManage,
    canDuplicate: canManage && Boolean(role?.is_active),
    canEdit: canManage && mutableRole,
    canDeactivate: canManage && mutableRole,
    canManagePermissions: canManage && mutableRole,
  };
}

export function formatRoleDate(value: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const ROLE_FORM_FLASH_KEY = "facilityops:role-form-success";

export function writeRoleFormFlash(message: string) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(ROLE_FORM_FLASH_KEY, message);
  }
}

export function readRoleFormFlash() {
  if (typeof window === "undefined") return null;
  const message = window.sessionStorage.getItem(ROLE_FORM_FLASH_KEY);
  if (message) window.sessionStorage.removeItem(ROLE_FORM_FLASH_KEY);
  return message;
}
