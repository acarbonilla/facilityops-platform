import type {
  Permission,
  PermissionGroup,
  ReplaceRolePermissionsPayload,
} from "@/types/rbac";

function comparePermissions(left: Permission, right: Permission): number {
  return (
    left.module.localeCompare(right.module) ||
    left.action.localeCompare(right.action) ||
    left.name.localeCompare(right.name)
  );
}

export function initializeAssignedPermissionSelection(
  permissions: Permission[],
): Set<string> {
  return new Set(permissions.map((permission) => permission.id));
}

export function buildReplaceRolePermissionsPayload(
  selectedPermissionIds: Iterable<string>,
): ReplaceRolePermissionsPayload {
  return {
    permission_ids: Array.from(new Set(selectedPermissionIds)),
  };
}

export function groupPermissionsByModule(
  permissions: Permission[],
): PermissionGroup[] {
  const groups = new Map<string, Permission[]>();

  for (const permission of [...permissions].sort(comparePermissions)) {
    const moduleKey = permission.module || "general";
    const items = groups.get(moduleKey) ?? [];
    items.push(permission);
    groups.set(moduleKey, items);
  }

  return Array.from(groups.entries()).map(([module, items]) => ({
    module,
    permissions: items,
  }));
}

export function searchPermissions(
  permissions: Permission[],
  query: string,
): Permission[] {
  const term = query.trim().toLowerCase();
  if (!term) {
    return permissions;
  }

  return permissions.filter((permission) => {
    const haystack = [
      permission.name,
      permission.code,
      permission.module,
      permission.action,
      permission.description,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });
}

export function selectAllVisible(
  selectedIds: Set<string>,
  visiblePermissions: Permission[],
): Set<string> {
  const next = new Set(selectedIds);
  for (const permission of visiblePermissions) {
    next.add(permission.id);
  }
  return next;
}

export function clearAllVisible(
  selectedIds: Set<string>,
  visiblePermissions: Permission[],
): Set<string> {
  const next = new Set(selectedIds);
  for (const permission of visiblePermissions) {
    next.delete(permission.id);
  }
  return next;
}
