import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import type { Permission, PermissionGroup } from "@/types/rbac";

function CellStack({
  primary,
  secondary,
}: {
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="min-w-0 whitespace-normal">
      <p className="font-medium text-slate-900">{primary}</p>
      {secondary ? <p className="mt-1 text-xs text-slate-500">{secondary}</p> : null}
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700",
      ].join(" ")}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export function groupPermissionsByModule(
  permissions: Permission[],
): PermissionGroup[] {
  const groups = new Map<string, Permission[]>();

  for (const permission of permissions) {
    const moduleKey = permission.module || "general";
    const items = groups.get(moduleKey) ?? [];
    items.push(permission);
    groups.set(moduleKey, items);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([module, items]) => ({
      module,
      permissions: [...items].sort((left, right) =>
        left.code.localeCompare(right.code),
      ),
    }));
}

export function PermissionGroupSection({
  group,
}: {
  group: PermissionGroup;
}) {
  const columns: DataTableColumn<Permission>[] = [
    {
      header: "Permission",
      cell: (permission) => (
        <CellStack primary={permission.name} secondary={permission.description} />
      ),
      className: "min-w-72",
    },
    {
      header: "Code",
      cell: (permission) => (
        <span className="font-mono text-xs text-slate-700">{permission.code}</span>
      ),
    },
    { header: "Action", cell: (permission) => permission.action },
    {
      header: "Status",
      cell: (permission) => <StatusBadge isActive={permission.is_active} />,
    },
  ];

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            Module
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {group.module}
          </h2>
        </div>
        <p className="text-sm text-slate-600">
          {group.permissions.length} permission
          {group.permissions.length === 1 ? "" : "s"}
        </p>
      </div>

      <DataTable
        caption={`${group.module} permissions`}
        columns={columns}
        getRowKey={(permission) => permission.id}
        rows={group.permissions}
      />
    </section>
  );
}
