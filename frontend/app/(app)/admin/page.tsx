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
  const canViewUsers = hasPermission("users.view");
  const canViewRoles = hasPermission("roles.view");
  const canManageRoles = hasPermission("roles.manage");

  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={["users.view", "roles.view", "roles.manage"]}
    >
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            description="Admin screens for roles, permissions, and the user-management foundation. Backend authorization remains authoritative, and unsupported operations stay hidden until the backend exposes them."
            eyebrow="RBAC administration"
            title="Admin"
          >
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField
                label="Users access"
                value={canViewUsers ? "Available" : "Unavailable"}
              />
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
                value="Read-only foundation"
              />
            </dl>
          </PageHeader>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <AdminCard
              description="Open the user-management foundation and review backend support status."
              enabled={canViewUsers}
              href="/admin/users"
              title="Users"
            />
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
              description="Audit-log workflows are not part of this foundation task."
              enabled={false}
              title="Audit Logs"
            />
          </div>

          <EmptyState
            title="Scoped admin foundation"
            message="This stage covers roles, permissions, and the user-management foundation only. Invitations, password reset, SSO, audit logs, and business-module administration remain out of scope."
          />
        </div>
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
