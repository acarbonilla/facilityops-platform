import type { Role } from "@/types/rbac";

function Badge({ label, tone }: { label: string; tone: "blue" | "green" | "slate" }) {
  const styles = {
    blue: "bg-blue-100 text-blue-800",
    green: "bg-emerald-100 text-emerald-800",
    slate: "bg-slate-200 text-slate-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>
      {label}
    </span>
  );
}

export function RoleTypeBadge({ role }: { role: Pick<Role, "is_system_role"> }) {
  return role.is_system_role ? (
    <Badge label="System" tone="blue" />
  ) : (
    <Badge label="Custom" tone="slate" />
  );
}

export function RoleStatusBadge({ role }: { role: Pick<Role, "is_active"> }) {
  return role.is_active ? (
    <Badge label="Active" tone="green" />
  ) : (
    <Badge label="Inactive" tone="slate" />
  );
}
