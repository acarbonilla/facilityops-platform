"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { useCreateMaintenanceWorkOrder } from "@/hooks/use-create-maintenance-work-order";
import { useMaintenanceDetail } from "@/hooks/use-maintenance-detail";
import { useMaintenanceFormDefaults } from "@/hooks/use-maintenance-form-defaults";
import { useMaintenanceFormOptions } from "@/hooks/use-maintenance-form-options";
import { useUpdateMaintenanceWorkOrder } from "@/hooks/use-update-maintenance-work-order";
import {
  mapMaintenanceFormValuesToCreatePayload,
  mapMaintenanceFormValuesToUpdatePayload,
  writeMaintenanceFormFlash,
} from "@/lib/maintenance/form";
import { formatMaintenanceError } from "@/lib/maintenance/display";
import { getFirstQueryErrorMessage } from "@/lib/master-data/display";

import {
  MaintenanceFormErrorState,
  MaintenanceFormSkeleton,
  MaintenanceWorkOrderForm,
} from "./maintenance-form";

function MaintenanceBreadcrumbs({
  currentLabel,
}: {
  currentLabel: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link className="hover:text-slate-700" href="/maintenance">
            Maintenance
          </Link>
        </li>
        <li>/</li>
        <li>
          <Link className="hover:text-slate-700" href="/maintenance/work-orders">
            Work orders
          </Link>
        </li>
        <li>/</li>
        <li className="text-slate-700">{currentLabel}</li>
      </ol>
    </nav>
  );
}

function MaintenanceFormLayout({
  children,
  description,
  errorMessage,
  title,
}: {
  children: React.ReactNode;
  description: string;
  errorMessage?: string | null;
  title: string;
}) {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          description={description}
          eyebrow="Maintenance"
          title={title}
        >
          <MaintenanceBreadcrumbs currentLabel={title} />
        </PageHeader>
        {errorMessage ? (
          <ErrorState
            message={errorMessage}
            title="Unable to save maintenance work order"
          />
        ) : null}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </section>
      </div>
    </AppShell>
  );
}

function MaintenanceProtectedFormState({
  children,
  requiredPermission,
}: {
  children: React.ReactNode;
  requiredPermission: string;
}) {
  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={[
        requiredPermission,
        requiredPermission.replace("maintenance.", "maintenance.work_order."),
      ]}
    >
      {children}
    </ProtectedPermissionRoute>
  );
}

function extractErrorMessage(error: unknown, fallback: string) {
  return formatMaintenanceError(error, fallback);
}

export function MaintenanceCreatePageContent() {
  const formOptionsQuery = useMaintenanceFormOptions();
  const defaultValues = useMaintenanceFormDefaults();
  const mutation = useCreateMaintenanceWorkOrder();
  const router = useRouter();

  if (formOptionsQuery.isPending) {
    return (
      <MaintenanceProtectedFormState requiredPermission="maintenance.create">
        <AppShell>
          <MaintenanceFormSkeleton />
        </AppShell>
      </MaintenanceProtectedFormState>
    );
  }

  if (formOptionsQuery.isError || !formOptionsQuery.data) {
    return (
      <MaintenanceProtectedFormState requiredPermission="maintenance.create">
        <AppShell>
          <MaintenanceFormErrorState
            message={extractErrorMessage(
              formOptionsQuery.error,
              "Maintenance form options could not be loaded.",
            )}
            title="Unable to load maintenance form"
          />
        </AppShell>
      </MaintenanceProtectedFormState>
    );
  }

  return (
    <MaintenanceProtectedFormState requiredPermission="maintenance.create">
      <MaintenanceFormLayout
        description="Create a standalone work order that is not generated from an FM Ticket. After creation, use Work Order Details to assign personnel and perform status actions. To create work from an FM Ticket, use Generate Work Order from the Ticket instead."
        errorMessage={
          mutation.isError
            ? extractErrorMessage(
                mutation.error,
                "Maintenance work order could not be created.",
              )
            : null
        }
        title="Create Standalone Work Order"
      >
        <MaintenanceWorkOrderForm
          cancelHref="/maintenance/work-orders"
          formOptions={formOptionsQuery.data}
          initialValues={defaultValues}
          isSubmitting={mutation.isPending}
          onSubmit={async (values) => {
            const createdWorkOrder = await mutation.mutateAsync(
              mapMaintenanceFormValuesToCreatePayload(values),
            );
            writeMaintenanceFormFlash("Maintenance work order created successfully.");
            router.replace(`/maintenance/work-orders/${createdWorkOrder.id}`);
            router.refresh();
          }}
          submitLabel="Create standalone work order"
        />
      </MaintenanceFormLayout>
    </MaintenanceProtectedFormState>
  );
}

export function MaintenanceEditPageContent({ id }: { id: string }) {
  const detailQuery = useMaintenanceDetail(id);
  const formOptionsQuery = useMaintenanceFormOptions();
  const mutation = useUpdateMaintenanceWorkOrder(id);
  const router = useRouter();
  const defaultValues = useMaintenanceFormDefaults(detailQuery.data);

  if (detailQuery.isPending || formOptionsQuery.isPending) {
    return (
      <MaintenanceProtectedFormState requiredPermission="maintenance.update">
        <AppShell>
          <MaintenanceFormSkeleton />
        </AppShell>
      </MaintenanceProtectedFormState>
    );
  }

  if (
    detailQuery.isError ||
    formOptionsQuery.isError ||
    !detailQuery.data ||
    !formOptionsQuery.data
  ) {
    return (
      <MaintenanceProtectedFormState requiredPermission="maintenance.update">
        <AppShell>
          <MaintenanceFormErrorState
            message={getFirstQueryErrorMessage(
              [detailQuery.error, formOptionsQuery.error],
              "Maintenance work order data could not be loaded.",
            )}
            title="Unable to load maintenance work order"
          />
        </AppShell>
      </MaintenanceProtectedFormState>
    );
  }

  return (
    <MaintenanceProtectedFormState requiredPermission="maintenance.update">
      <MaintenanceFormLayout
        description="Update persisted work-order fields only. Technician and Supervisor assignment, status actions, and attachments are managed from Work Order Details."
        errorMessage={
          mutation.isError
            ? extractErrorMessage(
                mutation.error,
                "Maintenance work order could not be updated.",
              )
            : null
        }
        title="Edit Work Order"
      >
        <MaintenanceWorkOrderForm
          cancelHref={`/maintenance/work-orders/${id}`}
          currentStatus={detailQuery.data.status}
          formOptions={formOptionsQuery.data}
          initialValues={defaultValues}
          isSubmitting={mutation.isPending}
          onSubmit={async (values) => {
            await mutation.mutateAsync(
              mapMaintenanceFormValuesToUpdatePayload(values),
            );
            writeMaintenanceFormFlash("Maintenance work order updated successfully.");
            router.replace(`/maintenance/work-orders/${id}`);
            router.refresh();
          }}
          submitLabel="Save work order"
        />
      </MaintenanceFormLayout>
    </MaintenanceProtectedFormState>
  );
}
