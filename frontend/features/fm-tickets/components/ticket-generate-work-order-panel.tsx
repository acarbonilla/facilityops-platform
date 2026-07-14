"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DetailField } from "@/components/common/detail-field";
import { usePermissions } from "@/hooks/use-permissions";
import {
  WORK_ORDER_GENERATION_CONFIRMATION,
  WORK_ORDER_GENERATION_EXPLANATION,
  buildMaintenanceWorkOrderDetailPath,
  canGenerateWorkOrderFromTicket,
  formatGenerateWorkOrderError,
  formatGenerateWorkOrderSuccess,
  formatWorkOrderGenerationDisabledReason,
  getGenerateWorkOrderActionLabel,
  getWorkOrderGenerationDisabledReason,
} from "@/lib/fm-tickets/work-order-generation";
import { generateWorkOrderFromTicket } from "@/services/api/fm-tickets";
import {
  fmTicketsQueryKeys,
  maintenanceQueryKeys,
  notificationQueryKeys,
} from "@/services/api/query-keys";
import type { FmTicketDetail } from "@/types/fm-tickets";

import { SectionCard, formatTicketLabel } from "./ticket-shared";

export function TicketGenerateWorkOrderPanel({
  ticket,
}: {
  ticket: FmTicketDetail;
}) {
  const { hasPermission } = usePermissions();
  const canManageGeneration =
    hasPermission("fm_tickets.assign") || hasPermission("fm_tickets.manage");
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => generateWorkOrderFromTicket(ticket.id),
    onSuccess: async (workOrder) => {
      setErrorMessage(null);
      setSuccessMessage(formatGenerateWorkOrderSuccess(workOrder));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: fmTicketsQueryKeys.detail(ticket.id) }),
        queryClient.invalidateQueries({ queryKey: fmTicketsQueryKeys.history(ticket.id) }),
        queryClient.invalidateQueries({ queryKey: fmTicketsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: maintenanceQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: maintenanceQueryKeys.detail(workOrder.id),
        }),
        queryClient.invalidateQueries({
          queryKey: maintenanceQueryKeys.assignments(workOrder.id),
        }),
        queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all }),
      ]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(formatGenerateWorkOrderError(error));
    },
  });

  if (!canManageGeneration && !ticket.linked_work_order) {
    return null;
  }

  const disabledReason = getWorkOrderGenerationDisabledReason(
    ticket,
    canManageGeneration,
  );
  const isEligible = canGenerateWorkOrderFromTicket(ticket, canManageGeneration);
  const actionLabel = getGenerateWorkOrderActionLabel(ticket);
  const disabledReasonMessage = formatWorkOrderGenerationDisabledReason(
    disabledReason,
  );

  function handleGenerate() {
    if (!isEligible || mutation.isPending) {
      return;
    }
    const confirmed = window.confirm(WORK_ORDER_GENERATION_CONFIRMATION);
    if (!confirmed) {
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    mutation.mutate();
  }

  return (
    <SectionCard title="Maintenance Work Order">
      <p className="mb-4 text-sm text-slate-600">{WORK_ORDER_GENERATION_EXPLANATION}</p>

      {ticket.linked_work_order ? (
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField
            label="Linked work order"
            value={ticket.linked_work_order.work_order_number}
          />
          <DetailField
            label="Work order status"
            value={formatTicketLabel(ticket.linked_work_order.status)}
          />
          <DetailField
            label="Work order title"
            value={ticket.linked_work_order.title}
          />
          <DetailField
            label="Open work order"
            value={
              <Link
                className="text-sm font-medium text-blue-700 underline-offset-2 hover:underline"
                href={buildMaintenanceWorkOrderDetailPath(
                  ticket.linked_work_order.id,
                )}
              >
                View Work Order
              </Link>
            }
          />
        </dl>
      ) : (
        <div className="space-y-3">
          {canManageGeneration && disabledReasonMessage ? (
            <p className="text-sm text-amber-800" role="status">
              {disabledReasonMessage}
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              This ticket meets the requirements for work order generation.
            </p>
          )}
          {canManageGeneration ? (
            <button
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!isEligible || mutation.isPending}
              onClick={handleGenerate}
              type="button"
            >
              {mutation.isPending ? "Generating..." : actionLabel}
            </button>
          ) : null}
        </div>
      )}

      {errorMessage ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="mt-4 text-sm text-emerald-700" role="status">
          {successMessage}
        </p>
      ) : null}
    </SectionCard>
  );
}
