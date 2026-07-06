"use client";

import Link from "next/link";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { usePermissions } from "@/hooks/use-permissions";

function AdminCard({
  href,
  title,
  description,
  enabled,
}: {
  href?: string;
  title: string;
  description: string;
  enabled: boolean;
}) {
  const content = (
    <article
      className={[
        "rounded-xl border p-5 shadow-sm transition",
        enabled
          ? "border-slate-200 bg-white hover:border-blue-300 hover:shadow"
          : "border-slate-200 bg-slate-100 text-slate-500",
      ].join(" ")}
    >
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
        Admin
      </p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <p className="mt-4 text-sm font-medium">
        {enabled ? "Open section" : "Planned for a later task"}
      </p>
    </article>
  );

  if (!enabled || !href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}

export default function AdminPage() {
  const { hasPermission } = usePermissions();
  const canViewRoles = hasPermission("roles.view");
  const canManageRoles = hasPermission("roles.manage");

  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={["roles.view", "roles.manage"]}
    >
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            description="RBAC administration screens for reviewing roles and the permission catalog. Backend authorization remains authoritative, and user management is intentionally deferred to FO-021."
            eyebrow="RBAC administration"
            title="Admin"
          >
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField
                label="Roles access"
                value={canViewRoles ? "Available" : "Unavailable"}
              />
              <DetailField
                label="Permissions access"
                value={canManageRoles ? "Available" : "Requires roles.manage"}
              />
              <DetailField
                label="User management"
                value="Deferred to FO-021"
              />
            </dl>
          </PageHeader>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <AdminCard
              description="View role metadata and current backend-backed role detail."
              enabled={canViewRoles}
              href="/admin/roles"
              title="Roles"
            />
            <AdminCard
              description="Browse the active permission catalog grouped by module."
              enabled={canManageRoles}
              href="/admin/permissions"
              title="Permissions"
            />
            <AdminCard
              description="User administration is intentionally deferred to the next approved task."
              enabled={false}
              title="Users"
            />
            <AdminCard
              description="Audit-log workflows are not part of this foundation task."
              enabled={false}
              title="Audit Logs"
            />
          </div>

          <EmptyState
            title="Scoped admin foundation"
            message="This stage covers roles and permission visibility only. User-role assignment, invitations, audit logs, and business-module administration remain out of scope."
          />
        </div>
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
