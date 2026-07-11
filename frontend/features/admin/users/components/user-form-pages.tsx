"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/hooks/use-auth";
import {
  useCreateUser,
  useUpdateUser,
  useUser,
  useUserFormOptions,
} from "@/hooks/use-users";
import {
  buildUserFormDefaults,
  mapUserCreatePayload,
  mapUserUpdatePayload,
  writeUserFormFlash,
} from "@/lib/users/form";

import { UserForm } from "./user-form";

function Breadcrumbs({ label }: { label: string }) {
  return <nav aria-label="Breadcrumb" className="text-sm text-slate-500"><Link className="hover:text-slate-700" href="/admin/users">Users</Link><span className="mx-2">/</span><span className="text-slate-700">{label}</span></nav>;
}

export function UserCreateScreen() {
  const { user: currentUser } = useAuth();
  const optionsQuery = useUserFormOptions();
  const mutation = useCreateUser();
  const router = useRouter();

  if (optionsQuery.isPending) return <LoadingState title="Loading user form" />;
  return <div className="space-y-6"><PageHeader description="Create a tenant-scoped FacilityOps account." eyebrow="Admin / Users" title="Create User"><Breadcrumbs label="Create" /></PageHeader>{mutation.isError ? <ErrorState message={mutation.error instanceof Error ? mutation.error.message : "The user could not be created."} title="Unable to create user" /> : null}<section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><UserForm cancelHref="/admin/users" currentUser={currentUser} initialValues={buildUserFormDefaults(null, currentUser)} isSubmitting={mutation.isPending} mode="create" onSubmit={async (values) => { const created = await mutation.mutateAsync(mapUserCreatePayload(values)); writeUserFormFlash("User created successfully."); router.replace(`/admin/users/${created.id}`); router.refresh(); }} organizations={optionsQuery.data?.organizations ?? []} submitLabel="Create user" tenants={optionsQuery.data?.tenants ?? []} /></section></div>;
}

export function UserEditScreen({ id }: { id: string }) {
  const { user: currentUser } = useAuth();
  const detailQuery = useUser(id);
  const optionsQuery = useUserFormOptions();
  const mutation = useUpdateUser(id);
  const router = useRouter();

  if (detailQuery.isPending || optionsQuery.isPending) return <LoadingState title="Loading user" />;
  if (detailQuery.isError || !detailQuery.data) return <ErrorState message="The user was not found or is not accessible in your tenant." title="Unable to load user" />;
  return <div className="space-y-6"><PageHeader description="Update profile, tenant-safe organization, password, and account status fields." eyebrow="Admin / Users" title="Edit User"><Breadcrumbs label="Edit" /></PageHeader>{mutation.isError ? <ErrorState message={mutation.error instanceof Error ? mutation.error.message : "The user could not be updated."} title="Unable to update user" /> : null}<section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><UserForm cancelHref={`/admin/users/${id}`} currentUser={currentUser} initialValues={buildUserFormDefaults(detailQuery.data, currentUser)} isSubmitting={mutation.isPending} mode="edit" onSubmit={async (values) => { await mutation.mutateAsync(mapUserUpdatePayload(values)); writeUserFormFlash("User updated successfully."); router.replace(`/admin/users/${id}`); router.refresh(); }} organizations={optionsQuery.data?.organizations ?? []} submitLabel="Save changes" tenants={optionsQuery.data?.tenants ?? []} /></section></div>;
}
