"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { useCreateRole, useRole, useUpdateRole } from "@/hooks/use-rbac";
import {
  buildRoleFormDefaults,
  mapRoleCreatePayload,
  mapRoleUpdatePayload,
  writeRoleFormFlash,
} from "@/lib/rbac/roles";
import { ApiError } from "@/services/api/types";

import { RoleForm } from "./role-form";

function Breadcrumbs({ label }: { label: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
      <Link className="hover:text-slate-700" href="/admin/roles">
        Roles
      </Link>
      <span className="mx-2">/</span>
      <span className="text-slate-700">{label}</span>
    </nav>
  );
}

export function RoleCreateScreen() {
  const mutation = useCreateRole();
  const router = useRouter();
  return (
    <div className="space-y-6">
      <PageHeader
        description="Create a custom global role. Its code becomes immutable after creation."
        eyebrow="Admin / Roles"
        title="Create Role"
      >
        <Breadcrumbs label="Create" />
      </PageHeader>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <RoleForm
          cancelHref="/admin/roles"
          initialValues={buildRoleFormDefaults()}
          isSubmitting={mutation.isPending}
          mode="create"
          onSubmit={async (values) => {
            const created = await mutation.mutateAsync(mapRoleCreatePayload(values));
            writeRoleFormFlash("Role created successfully.");
            router.replace(`/admin/roles/${created.id}`);
            router.refresh();
          }}
          submitLabel="Create role"
        />
      </section>
    </div>
  );
}

export function RoleEditScreen({ id }: { id: string }) {
  const detailQuery = useRole(id);
  const mutation = useUpdateRole(id);
  const router = useRouter();

  if (detailQuery.isPending) return <LoadingState title="Loading role" />;
  if (detailQuery.isError || !detailQuery.data) {
    const notFound =
      detailQuery.error instanceof ApiError && detailQuery.error.status === 404;
    return (
      <ErrorState
        message={
          notFound
            ? "The requested role does not exist."
            : detailQuery.error instanceof Error
              ? detailQuery.error.message
              : "The role could not be loaded."
        }
        title={notFound ? "Role not found" : "Unable to load role"}
      />
    );
  }

  const role = detailQuery.data;
  if (role.is_system_role) {
    return (
      <ErrorState
        action={
          <Link
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
            href={`/admin/roles/${id}`}
          >
            Return to role detail
          </Link>
        }
        message="System roles are protected. Their name, code, description, and status cannot be changed."
        title="System role is read-only"
      />
    );
  }
  if (!role.is_active) {
    return (
      <ErrorState
        action={
          <Link
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
            href={`/admin/roles/${id}`}
          >
            Return to role detail
          </Link>
        }
        message="Inactive roles cannot be edited from this screen, and reactivation is not available in FO-051."
        title="Inactive role is not editable"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Update custom-role metadata. The role code remains read-only."
        eyebrow="Admin / Roles"
        title="Edit Role"
      >
        <Breadcrumbs label="Edit" />
      </PageHeader>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <RoleForm
          cancelHref={`/admin/roles/${id}`}
          initialValues={buildRoleFormDefaults(role)}
          isSubmitting={mutation.isPending}
          mode="edit"
          onSubmit={async (values) => {
            await mutation.mutateAsync(mapRoleUpdatePayload(values));
            writeRoleFormFlash("Role updated successfully.");
            router.replace(`/admin/roles/${id}`);
            router.refresh();
          }}
          submitLabel="Save role changes"
        />
      </section>
    </div>
  );
}
