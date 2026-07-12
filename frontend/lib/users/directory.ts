import type { UserDirectoryItem } from "@/types/users";

export interface UserDirectoryPickerOption {
  id: string;
  value: string;
  label: string;
  email: string;
  tenant: string | null;
  organization: string | null;
  is_active: boolean;
}

export function mapUserDirectoryItemToOption(
  item: UserDirectoryItem,
): UserDirectoryPickerOption {
  return {
    id: item.id,
    value: item.id,
    label: item.display_name,
    email: item.email,
    tenant: item.tenant,
    organization: item.organization,
    is_active: item.is_active,
  };
}

export function mergeUserDirectoryOptions(
  items: UserDirectoryItem[],
  selectedUser?: UserDirectoryItem | null,
): UserDirectoryPickerOption[] {
  const users = selectedUser ? [selectedUser, ...items] : items;
  const uniqueUsers = new Map<string, UserDirectoryItem>();

  for (const user of users) {
    if (!uniqueUsers.has(user.id)) {
      uniqueUsers.set(user.id, user);
    }
  }

  return Array.from(uniqueUsers.values(), mapUserDirectoryItemToOption);
}

export function createUserDirectoryEmailFallback(
  id?: string | null,
  email?: string | null,
): UserDirectoryItem | null {
  if (!id || !email) {
    return null;
  }

  return {
    id,
    email,
    first_name: "",
    last_name: "",
    display_name: email,
    tenant: null,
    organization: null,
    is_active: true,
  };
}

export function normalizeOptionalUserId(value?: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function isUserInDirectoryScope(
  user: Pick<UserDirectoryItem, "tenant" | "organization">,
  tenant?: string | null,
  organization?: string | null,
): boolean {
  if (tenant && user.tenant && user.tenant !== tenant) {
    return false;
  }
  if (organization && user.organization && user.organization !== organization) {
    return false;
  }
  return true;
}

export function isUserDirectoryQueryEnabled(
  permissionEnabled: boolean,
  disabled = false,
): boolean {
  return permissionEnabled && !disabled;
}
