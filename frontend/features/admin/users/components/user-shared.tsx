import type { Organization, Tenant } from "@/types/master-data";

export function UserStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        active
          ? "bg-emerald-100 text-emerald-800"
          : "bg-slate-200 text-slate-700",
      ].join(" ")}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function StaffStatusBadge({ staff }: { staff: boolean }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        staff
          ? "bg-blue-100 text-blue-800"
          : "bg-slate-100 text-slate-700",
      ].join(" ")}
    >
      {staff ? "Staff" : "Standard user"}
    </span>
  );
}

export function formatUserDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function buildNameMap(items: Array<Tenant | Organization>) {
  return Object.fromEntries(items.map((item) => [item.id, item.name]));
}

export function resolveUserScopeName(
  id: string | null,
  names: Record<string, string>,
  emptyLabel: string,
) {
  if (!id) {
    return emptyLabel;
  }
  return names[id] ?? id;
}
