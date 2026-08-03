"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { usePermissions } from "@/hooks/use-permissions";
import {
  DEFAULT_MASTER_DATA_LIST_PARAMS,
  getFirstQueryErrorMessage,
} from "@/lib/master-data/display";
import { buildTicketCreateSuccessHref } from "@/lib/fm-tickets/create-image-staging";
import {
  getAreas,
  getAssets,
  getBuildings,
  getDepartments,
  getFloors,
  getOrganizations,
  getTenants,
} from "@/services/api/master-data";
import {
  createFmTicket,
  getFmTicket,
  queueFmTicketAiAnalysis,
  updateFmTicket,
} from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys, masterDataQueryKeys } from "@/services/api/query-keys";
import type {
  FmTicketCategory,
  FmTicketCreatePayload,
  FmTicketDetail,
  FmTicketFormValues,
  FmTicketPriority,
  FmTicketUpdatePayload,
} from "@/types/fm-tickets";
import { ATTACHMENT_PERMISSIONS } from "@/types/attachments";

import {
  TicketCreateImageStaging,
  type TicketCreateImageStagingHandle,
} from "./ticket-create-image-staging";
import { TicketAiAnalysisStatusPanel } from "./ticket-ai-analysis-status";
import { TicketForm } from "./ticket-form";

function extractErrorMessage(error: unknown, fallback: string) {
  return getFirstQueryErrorMessage([error], fallback);
}

function normalizeOptionalValue(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeDueAt(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const parsed = new Date(trimmedValue);
  if (Number.isNaN(parsed.getTime())) {
    return trimmedValue;
  }

  return parsed.toISOString();
}

function formatDateTimeLocalValue(value?: string | null): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const timezoneOffset = parsed.getTimezoneOffset();
  const localDate = new Date(parsed.getTime() - timezoneOffset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function mapTicketFormValuesToPayload(
  values: FmTicketFormValues,
): FmTicketCreatePayload | FmTicketUpdatePayload {
  return {
    tenant: values.tenant,
    organization: values.organization,
    department: normalizeOptionalValue(values.department),
    building: values.building,
    floor: normalizeOptionalValue(values.floor),
    area: normalizeOptionalValue(values.area),
    asset: normalizeOptionalValue(values.asset),
    title: values.title.trim(),
    description: values.description.trim(),
    category: values.category,
    priority: values.priority,
    source: values.source,
    due_at: normalizeDueAt(values.due_at),
  };
}

function mapTicketDetailToFormValues(ticket: FmTicketDetail): FmTicketFormValues {
  return {
    tenant: ticket.tenant,
    organization: ticket.organization,
    department: ticket.department ?? "",
    building: ticket.building,
    floor: ticket.floor ?? "",
    area: ticket.area ?? "",
    asset: ticket.asset ?? "",
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    source: ticket.source,
    due_at: formatDateTimeLocalValue(ticket.due_at),
    status: ticket.status,
    assignee: ticket.assignee ?? "",
  };
}

function TicketFormPageLayout({
  children,
  description,
  errorMessage,
  title,
  requiredPermission,
}: {
  children: React.ReactNode;
  description: string;
  errorMessage?: string | null;
  title: string;
  requiredPermission: string;
}) {
  return (
    <ProtectedPermissionRoute requiredPermission={requiredPermission}>
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            description={description}
            eyebrow="FM Ticketing"
            title={title}
          />
          {errorMessage ? (
            <ErrorState message={errorMessage} title="Unable to save FM ticket" />
          ) : null}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {children}
          </section>
        </div>
      </AppShell>
    </ProtectedPermissionRoute>
  );
}

function TicketPageState({
  message,
  requiredPermission,
  title,
  variant,
}: {
  message: string;
  requiredPermission: string;
  title: string;
  variant: "loading" | "error";
}) {
  return (
    <ProtectedPermissionRoute requiredPermission={requiredPermission}>
      <AppShell>
        {variant === "loading" ? (
          <LoadingState title={title} message={message} />
        ) : (
          <ErrorState title={title} message={message} />
        )}
      </AppShell>
    </ProtectedPermissionRoute>
  );
}

function useTicketRelatedOptions() {
  const tenantsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("tenants", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getTenants(DEFAULT_MASTER_DATA_LIST_PARAMS),
    select: (data) => data.results,
  });
  const organizationsQuery = useQuery({
    queryKey: masterDataQueryKeys.list(
      "organizations",
      DEFAULT_MASTER_DATA_LIST_PARAMS,
    ),
    queryFn: () => getOrganizations(DEFAULT_MASTER_DATA_LIST_PARAMS),
    select: (data) => data.results,
  });
  const departmentsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("departments", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getDepartments(DEFAULT_MASTER_DATA_LIST_PARAMS),
    select: (data) => data.results,
  });
  const buildingsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("buildings", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getBuildings(DEFAULT_MASTER_DATA_LIST_PARAMS),
    select: (data) => data.results,
  });
  const floorsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("floors", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getFloors(DEFAULT_MASTER_DATA_LIST_PARAMS),
    select: (data) => data.results,
  });
  const areasQuery = useQuery({
    queryKey: masterDataQueryKeys.list("areas", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getAreas(DEFAULT_MASTER_DATA_LIST_PARAMS),
    select: (data) => data.results,
  });
  const assetsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("assets", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getAssets(DEFAULT_MASTER_DATA_LIST_PARAMS),
    select: (data) => data.results,
  });

  return {
    tenantsQuery,
    organizationsQuery,
    departmentsQuery,
    buildingsQuery,
    floorsQuery,
    areasQuery,
    assetsQuery,
  };
}

function useFmTicketMutation<TResult>(
  mutationFn: (payload: FmTicketCreatePayload | FmTicketUpdatePayload) => Promise<TResult>,
  successHref: (record: TResult) => string,
) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn,
    onSuccess: async (record) => {
      await queryClient.invalidateQueries({
        queryKey: fmTicketsQueryKeys.all,
      });
      router.replace(successHref(record));
      router.refresh();
    },
  });
}

export function TicketCreatePageContent() {
  const {
    areasQuery,
    assetsQuery,
    buildingsQuery,
    departmentsQuery,
    floorsQuery,
    organizationsQuery,
    tenantsQuery,
  } = useTicketRelatedOptions();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canUploadAttachments = hasPermission(ATTACHMENT_PERMISSIONS.upload);
  const imageStagingRef = useRef<TicketCreateImageStagingHandle>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (
    tenantsQuery.isPending ||
    organizationsQuery.isPending ||
    departmentsQuery.isPending ||
    buildingsQuery.isPending ||
    floorsQuery.isPending ||
    areasQuery.isPending ||
    assetsQuery.isPending
  ) {
    return (
      <TicketPageState
        message="Loading the FM ticket form and related master-data options."
        requiredPermission="fm_tickets.create"
        title="Loading ticket form"
        variant="loading"
      />
    );
  }

  if (
    tenantsQuery.isError ||
    organizationsQuery.isError ||
    departmentsQuery.isError ||
    buildingsQuery.isError ||
    floorsQuery.isError ||
    areasQuery.isError ||
    assetsQuery.isError
  ) {
    return (
      <TicketPageState
        message={getFirstQueryErrorMessage(
          [
            tenantsQuery.error,
            organizationsQuery.error,
            departmentsQuery.error,
            buildingsQuery.error,
            floorsQuery.error,
            areasQuery.error,
            assetsQuery.error,
          ],
          "Ticket form options could not be loaded.",
        )}
        requiredPermission="fm_tickets.create"
        title="Unable to load ticket form"
        variant="error"
      />
    );
  }

  return (
    <TicketFormPageLayout
      description="Create a new FM ticket using the existing backend foundation and related master-data references."
      errorMessage={submitError}
      requiredPermission="fm_tickets.create"
      title="New FM Ticket"
    >
      <TicketForm
        areas={areasQuery.data ?? []}
        assets={assetsQuery.data ?? []}
        beforeSubmit={
          canUploadAttachments ? (
            <TicketCreateImageStaging
              ref={imageStagingRef}
              canUpload={canUploadAttachments}
              disabled={isSubmitting}
            />
          ) : null
        }
        buildings={buildingsQuery.data ?? []}
        cancelHref="/fm-tickets"
        departments={departmentsQuery.data ?? []}
        floors={floorsQuery.data ?? []}
        isSubmitting={isSubmitting}
        onSubmit={async (values) => {
          setSubmitError(null);
          if (imageStagingRef.current?.hasRejected()) {
            setSubmitError("Remove or replace rejected images before submitting.");
            return;
          }

          setIsSubmitting(true);
          try {
            const created = await createFmTicket(mapTicketFormValuesToPayload(values));
            const uploadable =
              imageStagingRef.current?.getUploadableFiles().length ?? 0;
            let aiQueued = false;

            if (uploadable > 0 && imageStagingRef.current) {
              const attachmentIds = await imageStagingRef.current.uploadAll({
                owner_type: "fm_ticket",
                owner_id: created.id,
                visibility: "internal_only",
                category: "image_evidence",
              });
              if (attachmentIds.length > 0) {
                await queueFmTicketAiAnalysis(created.id, {
                  attachment_ids: attachmentIds,
                });
                aiQueued = true;
              }
            }

            await queryClient.invalidateQueries({
              queryKey: fmTicketsQueryKeys.all,
            });
            router.replace(
              buildTicketCreateSuccessHref(`/fm-tickets/${created.id}`, {
                aiQueued,
              }),
            );
            router.refresh();
          } catch (error) {
            setSubmitError(
              extractErrorMessage(error, "FM ticket could not be created."),
            );
          } finally {
            setIsSubmitting(false);
          }
        }}
        organizations={organizationsQuery.data ?? []}
        submitLabel="Submit Ticket"
        tenants={tenantsQuery.data ?? []}
      />
    </TicketFormPageLayout>
  );
}

function readAiApplyFromSearch(search: string): {
  category: FmTicketCategory;
  priority: FmTicketPriority;
} | null {
  const params = new URLSearchParams(search);
  const category = params.get("ai_category");
  const priority = params.get("ai_priority");
  const categories = new Set([
    "electrical",
    "plumbing",
    "hvac",
    "civil",
    "safety",
    "cleaning",
    "security",
    "other",
  ]);
  const priorities = new Set(["low", "medium", "high", "urgent"]);
  if (
    category &&
    priority &&
    categories.has(category) &&
    priorities.has(priority)
  ) {
    return {
      category: category as FmTicketCategory,
      priority: priority as FmTicketPriority,
    };
  }
  return null;
}

export function TicketEditPageContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission("fm_tickets.update");
  const recordQuery = useQuery({
    queryKey: fmTicketsQueryKeys.detail(id),
    queryFn: () => getFmTicket(id),
  });
  const {
    areasQuery,
    assetsQuery,
    buildingsQuery,
    departmentsQuery,
    floorsQuery,
    organizationsQuery,
    tenantsQuery,
  } = useTicketRelatedOptions();
  const mutation = useFmTicketMutation(
    (payload) => updateFmTicket(id, payload),
    () => `/fm-tickets/${id}`,
  );
  const [appliedRecommendation, setAppliedRecommendation] = useState<{
    category: FmTicketCategory;
    priority: FmTicketPriority;
    token: number;
  } | null>(null);

  const searchApply = useMemo(
    () => readAiApplyFromSearch(searchParams.toString()),
    [searchParams],
  );

  const initialApplyToken = useMemo(() => {
    if (!searchApply) {
      return null;
    }
    return {
      category: searchApply.category,
      priority: searchApply.priority,
      token: 1,
    };
  }, [searchApply]);

  const activeApply = appliedRecommendation ?? initialApplyToken;

  if (
    recordQuery.isPending ||
    tenantsQuery.isPending ||
    organizationsQuery.isPending ||
    departmentsQuery.isPending ||
    buildingsQuery.isPending ||
    floorsQuery.isPending ||
    areasQuery.isPending ||
    assetsQuery.isPending
  ) {
    return (
      <TicketPageState
        message="Loading the selected FM ticket and related master-data options."
        requiredPermission="fm_tickets.update"
        title="Loading ticket"
        variant="loading"
      />
    );
  }

  if (
    recordQuery.isError ||
    tenantsQuery.isError ||
    organizationsQuery.isError ||
    departmentsQuery.isError ||
    buildingsQuery.isError ||
    floorsQuery.isError ||
    areasQuery.isError ||
    assetsQuery.isError ||
    !recordQuery.data
  ) {
    return (
      <TicketPageState
        message={getFirstQueryErrorMessage(
          [
            recordQuery.error,
            tenantsQuery.error,
            organizationsQuery.error,
            departmentsQuery.error,
            buildingsQuery.error,
            floorsQuery.error,
            areasQuery.error,
            assetsQuery.error,
          ],
          "Ticket data could not be loaded.",
        )}
        requiredPermission="fm_tickets.update"
        title="Unable to load ticket"
        variant="error"
      />
    );
  }

  return (
    <TicketFormPageLayout
      description="Update the selected FM ticket without changing assignment, comments, or workflow status."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "FM ticket could not be updated.")
          : null
      }
      requiredPermission="fm_tickets.update"
      title="Edit FM Ticket"
    >
      <div className="space-y-5">
        <TicketAiAnalysisStatusPanel
          audience="internal"
          canReview={canUpdate}
          ticketId={id}
          onApplyRecommendation={(selection) => {
            setAppliedRecommendation({
              category: selection.category,
              priority: selection.priority,
              token: Date.now(),
            });
          }}
        />
        <TicketForm
          areas={areasQuery.data ?? []}
          assets={assetsQuery.data ?? []}
          appliedRecommendation={activeApply}
          buildings={buildingsQuery.data ?? []}
          cancelHref={`/fm-tickets/${id}`}
          currentStatus={recordQuery.data.status}
          departments={departmentsQuery.data ?? []}
          floors={floorsQuery.data ?? []}
          initialValues={mapTicketDetailToFormValues(recordQuery.data)}
          isSubmitting={mutation.isPending}
          onSubmit={async (values) => {
            await mutation.mutateAsync(mapTicketFormValuesToPayload(values));
          }}
          organizations={organizationsQuery.data ?? []}
          submitLabel="Save ticket"
          tenants={tenantsQuery.data ?? []}
        />
      </div>
    </TicketFormPageLayout>
  );
}
