"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { FormActions } from "@/components/common/form-actions";
import { SelectField } from "@/components/common/select-field";
import { usePermissions } from "@/hooks/use-permissions";
import { fmTicketStatusUpdateSchema } from "@/lib/validations/fm-tickets";
import { changeFmTicketStatus } from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys } from "@/services/api/query-keys";
import type {
  FmTicketDetail,
  FmTicketStatus,
  FmTicketStatusUpdatePayload,
  FmTicketWorkflowAction,
} from "@/types/fm-tickets";
import { FM_TICKET_STATUS_TRANSITIONS } from "@/types/fm-tickets";

import { TicketStatusBadge } from "./ticket-status-badge";
import { SectionCard, formatTicketLabel } from "./ticket-shared";

const CLOSE_PERMISSION_STATUSES = new Set<FmTicketStatus>([
  "resolved",
  "closed",
  "cancelled",
]);

interface TicketStatusFormValues {
  to_status: FmTicketStatus;
  note: string;
}

function buildWorkflowActions(
  currentStatus: FmTicketStatus,
): FmTicketWorkflowAction[] {
  const transition =
    FM_TICKET_STATUS_TRANSITIONS.find((item) => item.from === currentStatus) ?? null;

  return (transition?.to ?? []).map((to_status) => ({
    label: formatTicketLabel(to_status),
    to_status,
    requiresClosePermission: CLOSE_PERMISSION_STATUSES.has(to_status),
  }));
}

export function TicketStatusActions({ ticket }: { ticket: FmTicketDetail }) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission("fm_tickets.update");
  const canClose = hasPermission("fm_tickets.close");
  const canManage = hasPermission("fm_tickets.manage");
  const allActions = useMemo(
    () => buildWorkflowActions(ticket.status),
    [ticket.status],
  );
  const availableActions = useMemo(
    () =>
      allActions.filter((action) => {
        if (action.requiresClosePermission) {
          return canClose || canManage;
        }

        return canUpdate || canManage;
      }),
    [allActions, canClose, canManage, canUpdate],
  );
  const defaultStatus = availableActions[0]?.to_status ?? ticket.status;
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<TicketStatusFormValues>({
    resolver: zodResolver(fmTicketStatusUpdateSchema),
    defaultValues: {
      to_status: defaultStatus,
      note: "",
    },
  });
  const mutation = useMutation({
    mutationFn: (payload: FmTicketStatusUpdatePayload) =>
      changeFmTicketStatus(ticket.id, payload),
    onSuccess: async (updatedTicket) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.detail(ticket.id),
        }),
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.comments(ticket.id),
        }),
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.history(ticket.id),
        }),
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.all,
        }),
      ]);
      setSuccessMessage(
        `Ticket status updated to ${formatTicketLabel(updatedTicket.status)}.`,
      );
      reset({
        to_status: updatedTicket.status,
        note: "",
      });
    },
  });

  useEffect(() => {
    if (availableActions.length === 0) {
      return;
    }

    reset({
      to_status: availableActions[0].to_status,
      note: "",
    });
  }, [availableActions, reset]);

  if (availableActions.length === 0) {
    return (
      <SectionCard
        title="Status Workflow"
        description="No further workflow transitions are available from the current ticket status for this account."
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="font-medium text-slate-900">Current status</p>
          <div className="mt-3">
            <TicketStatusBadge status={ticket.status} />
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Status Workflow"
      description="Basic status transitions are enforced by backend permissions. Resolved, closed, and cancelled transitions currently require close or manage permission."
    >
      {mutation.isError ? (
        <ErrorState
          title="Unable to change status"
          message={
            mutation.error instanceof Error
              ? mutation.error.message
              : "The ticket status could not be changed."
          }
        />
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-medium text-emerald-950">Status updated</p>
          <p className="mt-1 text-sm text-emerald-800">{successMessage}</p>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">Current status</p>
        <div className="mt-3">
          <TicketStatusBadge status={ticket.status} />
        </div>
      </div>

      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setSuccessMessage(null);
          await mutation.mutateAsync({
            to_status: values.to_status,
            note: values.note?.trim() ?? "",
          });
        })}
      >
        <SelectField
          description="Only transitions permitted by the current backend permission model are shown."
          error={errors.to_status?.message}
          label="Next status"
          options={availableActions.map((action) => ({
            value: action.to_status,
            label: action.label,
          }))}
          {...register("to_status")}
        />

        <FormField
          description="Optional workflow note stored with the backend status-change action."
          error={errors.note?.message}
          htmlFor="ticket-status-note"
          label="Note"
        >
          <textarea
            className="block min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            id="ticket-status-note"
            {...register("note")}
          />
        </FormField>

        <FormActions
          cancelHref={`/fm-tickets/${ticket.id}`}
          isSubmitting={mutation.isPending}
          submitLabel="Update status"
        />
      </form>
    </SectionCard>
  );
}
