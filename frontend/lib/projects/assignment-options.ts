/**
 * FO-115C assignment option helpers (Project Manager / Task PIC).
 */

export interface ProjectAssignmentOption {
  id: string;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
  role_label: string;
  is_project_manager?: boolean;
  is_project_member?: boolean;
  is_active: boolean;
}

export function formatAssignmentOptionLabel(
  option: ProjectAssignmentOption,
): string {
  const name = option.display_name?.trim() || option.email;
  const role = option.role_label?.trim();
  if (role && name !== option.email) {
    return `${name} · ${role} · ${option.email}`;
  }
  if (role) {
    return `${name} · ${role}`;
  }
  if (name !== option.email) {
    return `${name} · ${option.email}`;
  }
  return name;
}

export function createAssignmentOptionFallback(options: {
  id?: string | null;
  email?: string | null;
  displayName?: string | null;
  roleLabel?: string | null;
}): ProjectAssignmentOption | null {
  if (!options.id) return null;
  const email = options.email?.trim() || "";
  return {
    id: options.id,
    email,
    display_name: options.displayName?.trim() || email || options.id,
    first_name: "",
    last_name: "",
    role_label: options.roleLabel?.trim() || "Assigned",
    is_active: true,
  };
}

export function mergeAssignmentOptions(
  items: ProjectAssignmentOption[],
  selected?: ProjectAssignmentOption | null,
): ProjectAssignmentOption[] {
  const map = new Map<string, ProjectAssignmentOption>();
  if (selected) {
    map.set(selected.id, selected);
  }
  for (const item of items) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}
