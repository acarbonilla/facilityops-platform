import { hasPermission } from "@/lib/auth/permissions";
import type { AuthUser } from "@/types/auth";
import type { PermissionCode } from "@/types/rbac";
import type {
  UserCreatePayload,
  UserFormValues,
  UserRecord,
  UserUpdatePayload,
} from "@/types/users";

export function getUserDisplayName(
  user: Pick<UserRecord, "email" | "first_name" | "last_name">,
) {
  return [user.first_name.trim(), user.last_name.trim()]
    .filter(Boolean)
    .join(" ") || user.email;
}

export function normalizeNullableUuid(value?: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function normalizeUserFormSubmission(
  values: UserFormValues,
  currentUser: Pick<AuthUser, "tenant"> | null,
  initialValues: Pick<UserFormValues, "is_staff">,
  mayManageStaff: boolean,
): UserFormValues {
  return {
    ...values,
    tenant: currentUser?.tenant ?? values.tenant ?? "",
    is_staff: mayManageStaff ? values.is_staff : initialValues.is_staff,
  };
}

export function buildUserFormDefaults(
  user?: UserRecord | null,
  currentUser?: AuthUser | null,
): UserFormValues {
  return {
    email: user?.email ?? "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    tenant: user?.tenant ?? currentUser?.tenant ?? "",
    organization: user?.organization ?? "",
    password: "",
    confirm_password: "",
    is_active: user?.is_active ?? true,
    is_staff: user?.is_staff ?? false,
  };
}

function mapSharedValues(values: UserFormValues) {
  return {
    email: values.email.trim(),
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    tenant: normalizeNullableUuid(values.tenant),
    organization: normalizeNullableUuid(values.organization),
    is_active: values.is_active,
    is_staff: values.is_staff,
  };
}

export function mapUserCreatePayload(
  values: UserFormValues,
): UserCreatePayload {
  return {
    ...mapSharedValues(values),
    password: values.password,
  };
}

export function mapUserUpdatePayload(
  values: UserFormValues,
): UserUpdatePayload {
  const password = values.password.trim();
  return {
    ...mapSharedValues(values),
    ...(password ? { password: values.password } : {}),
  };
}

export function getUserActionPermissions(
  permissions: PermissionCode[],
  currentUser: AuthUser | null,
  target?: Pick<UserRecord, "id" | "is_active"> | null,
) {
  return {
    canCreate: hasPermission(permissions, "users.create", currentUser),
    canEdit: hasPermission(permissions, "users.update", currentUser),
    canDeactivate:
      Boolean(target?.is_active) &&
      target?.id !== currentUser?.id &&
      hasPermission(permissions, "users.delete", currentUser),
  };
}

export function canManageStaffStatus(currentUser: AuthUser | null) {
  return Boolean(currentUser?.is_staff && !currentUser.tenant);
}

const USER_FORM_FLASH_KEY = "facilityops:user-form-success";

export function writeUserFormFlash(message: string) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(USER_FORM_FLASH_KEY, message);
  }
}

export function readUserFormFlash() {
  if (typeof window === "undefined") {
    return null;
  }
  const message = window.sessionStorage.getItem(USER_FORM_FLASH_KEY);
  if (message) {
    window.sessionStorage.removeItem(USER_FORM_FLASH_KEY);
  }
  return message;
}
