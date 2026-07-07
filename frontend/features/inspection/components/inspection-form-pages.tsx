"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { useCreateInspection } from "@/hooks/use-create-inspection";
import { useInspectionDetail } from "@/hooks/use-inspection-detail";
import { useInspectionFormDefaults } from "@/hooks/use-inspection-form-defaults";
import { useInspectionFormOptions } from "@/hooks/use-inspection-form-options";
import { useUpdateInspection } from "@/hooks/use-update-inspection";
import {
  mapInspectionFormValuesToCreatePayload,
  mapInspectionFormValuesToUpdatePayload,
  writeInspectionFormFlash,
} from "@/lib/inspection/form";
import { getFirstQueryErrorMessage } from "@/lib/master-data/display";

import {
  InspectionForm,
  InspectionFormErrorState,
  InspectionFormSkeleton,
} from "./inspection-form";

function InspectionBreadcrumbs({
  currentLabel,
}: {
  currentLabel: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link className="hover:text-slate-700" href="/inspection/inspections">
            Inspections
          </Link>
        </li>
        <li>/</li>
        <li className="text-slate-700">{currentLabel}</li>
      </ol>
    </nav>
  );
}

function InspectionFormLayout({
  children,
  description,
  errorMessage,
  title,
}: {
  children: ReactNode;
  description: string;
  errorMessage?: string | null;
  title: string;
}) {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          description={description}
          eyebrow="5S Inspection"
          title={title}
        >
          <InspectionBreadcrumbs currentLabel={title} />
        </PageHeader>
        {errorMessage ? (
          <ErrorState
            message={errorMessage}
            title="Unable to save inspection"
          />
        ) : null}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </section>
      </div>
    </AppShell>
  );
}

function extractErrorMessage(error: unknown, fallback: string) {
  return getFirstQueryErrorMessage([error], fallback);
}

function InspectionProtectedFormState({
  children,
  requiredPermissions,
}: {
  children: ReactNode;
  requiredPermissions: string[];
}) {
  return (
    <ProtectedPermissionRoute mode="any" requiredPermissions={requiredPermissions}>
      {children}
    </ProtectedPermissionRoute>
  );
}

export function InspectionCreatePageContent() {
  const formOptionsQuery = useInspectionFormOptions();
  const defaultValues = useInspectionFormDefaults();
  const mutation = useCreateInspection();
  const router = useRouter();

  if (formOptionsQuery.isPending) {
    return (
      <InspectionProtectedFormState
        requiredPermissions={["inspection.create", "inspection.manage"]}
      >
        <AppShell>
          <InspectionFormSkeleton />
        </AppShell>
      </InspectionProtectedFormState>
    );
  }

  if (formOptionsQuery.isError || !formOptionsQuery.data) {
    return (
      <InspectionProtectedFormState
        requiredPermissions={["inspection.create", "inspection.manage"]}
      >
        <AppShell>
          <InspectionFormErrorState
            message={extractErrorMessage(
              formOptionsQuery.error,
              "Inspection form options could not be loaded.",
            )}
            title="Unable to load inspection form"
          />
        </AppShell>
      </InspectionProtectedFormState>
    );
  }

  return (
    <InspectionProtectedFormState
      requiredPermissions={["inspection.create", "inspection.manage"]}
    >
      <InspectionFormLayout
        description="Create a 5S inspection record using the current inspection backend foundation without entering workflow actions."
        errorMessage={
          mutation.isError
            ? extractErrorMessage(
                mutation.error,
                "Inspection could not be created.",
              )
            : null
        }
        title="New Inspection"
      >
        <InspectionForm
          cancelHref="/inspection/inspections"
          formOptions={formOptionsQuery.data}
          initialValues={defaultValues}
          isSubmitting={mutation.isPending}
          onSubmit={async (values) => {
            const inspection = await mutation.mutateAsync(
              mapInspectionFormValuesToCreatePayload(values),
            );
            writeInspectionFormFlash("Inspection created successfully.");
            router.replace(`/inspection/inspections/${inspection.id}`);
            router.refresh();
          }}
          submitLabel="Create inspection"
        />
      </InspectionFormLayout>
    </InspectionProtectedFormState>
  );
}

export function InspectionEditPageContent({ id }: { id: string }) {
  const detailQuery = useInspectionDetail(id);
  const formOptionsQuery = useInspectionFormOptions();
  const mutation = useUpdateInspection(id);
  const router = useRouter();
  const defaultValues = useInspectionFormDefaults(detailQuery.data);

  if (detailQuery.isPending || formOptionsQuery.isPending) {
    return (
      <InspectionProtectedFormState
        requiredPermissions={["inspection.update", "inspection.manage"]}
      >
        <AppShell>
          <InspectionFormSkeleton />
        </AppShell>
      </InspectionProtectedFormState>
    );
  }

  if (
    detailQuery.isError ||
    formOptionsQuery.isError ||
    !detailQuery.data ||
    !formOptionsQuery.data
  ) {
    return (
      <InspectionProtectedFormState
        requiredPermissions={["inspection.update", "inspection.manage"]}
      >
        <AppShell>
          <InspectionFormErrorState
            message={getFirstQueryErrorMessage(
              [detailQuery.error, formOptionsQuery.error],
              "Inspection data could not be loaded.",
            )}
            title="Unable to load inspection"
          />
        </AppShell>
      </InspectionProtectedFormState>
    );
  }

  return (
    <InspectionProtectedFormState
      requiredPermissions={["inspection.update", "inspection.manage"]}
    >
      <InspectionFormLayout
        description="Update the selected inspection without entering workflow actions such as assignment, start, completion, verification, or cancellation."
        errorMessage={
          mutation.isError
            ? extractErrorMessage(
                mutation.error,
                "Inspection could not be updated.",
              )
            : null
        }
        title="Edit Inspection"
      >
        <InspectionForm
          cancelHref={`/inspection/inspections/${id}`}
          currentStatus={detailQuery.data.status}
          formOptions={formOptionsQuery.data}
          initialValues={defaultValues}
          inspectorLabel={detailQuery.data.inspector_email}
          isSubmitting={mutation.isPending}
          onSubmit={async (values) => {
            await mutation.mutateAsync(
              mapInspectionFormValuesToUpdatePayload(values),
            );
            writeInspectionFormFlash("Inspection updated successfully.");
            router.replace(`/inspection/inspections/${id}`);
            router.refresh();
          }}
          submitLabel="Save inspection"
          supervisorLabel={detailQuery.data.supervisor_email}
        />
      </InspectionFormLayout>
    </InspectionProtectedFormState>
  );
}
