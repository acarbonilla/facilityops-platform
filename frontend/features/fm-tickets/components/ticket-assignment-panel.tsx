"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DetailField } from "@/components/common/detail-field";
import { FormField } from "@/components/common/form-field";
import { UserDirectoryPicker } from "@/components/common/user-directory-picker";
import { usePermissions } from "@/hooks/use-permissions";
import {
  FM_TICKET_REASSIGNMENT_CONFIRMATION,
  buildFmTicketAssigneeFallback,
  buildFmTicketAssignmentPayload,
  formatFmTicketAssignmentError,
  formatFmTicketAssignmentSuccess,
  getFmTicketAssignmentActionLabel,
  getFmTicketAssignmentStatusLabel,
  resolveFmTicketAssignmentState,
  shouldConfirmFmTicketReassignment,
} from "@/lib/fm-tickets/assignment";
import { assignFmTicket } from "@/services/api/fm-tickets";
import {
  fmTicketsQueryKeys,
  notificationQueryKeys,
} from "@/services/api/query-keys";
import type { FmTicketDetail } from "@/types/fm-tickets";

import { SectionCard, formatPersonLabel } from "./ticket-shared";

export function TicketAssignmentPanel({ ticket }: { ticket: FmTicketDetail }) {
  const { hasPermission } = usePermissions();
  const canAssign = hasPermission("fm_tickets.assign");
  const canReadDirectory = hasPermission("users.directory");
  const assignmentState = resolveFmTicketAssignmentState({
    canAssign,
    canReadDirectory,
  });
  const queryClient = useQueryClient();
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(
    ticket.assignee,
  );
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedAssignee(ticket.assignee);
  }, [ticket.assignee, ticket.id]);

  const mutation = useMutation({
    mutationFn: (payload: { assignee: string; note?: string }) =>
      assignFmTicket(ticket.id, payload),
    onSuccess: async (updatedTicket) => {
      setErrorMessage(null);
      setValidationError(null);
      setSuccessMessage(
        formatFmTicketAssignmentSuccess(updatedTicket.assignee_email),
      );
      setNote("");
      setSelectedAssignee(updatedTicket.assignee);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.detail(ticket.id),
        }),
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.history(ticket.id),
        }),
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.comments(ticket.id),
        }),
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.escalations(ticket.id),
        }),
        queryClient.invalidateQueries({ queryKey: fmTicketsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all }),
      ]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(formatFmTicketAssignmentError(error));
    },
  });

  function handleAssign() {
    if (mutation.isPending) {
      return;
    }
    const payload = buildFmTicketAssignmentPayload(selectedAssignee, note);
    if (!payload) {
      setValidationError("Select a technician before assigning this ticket.");
      return;
    }
    if (
      shouldConfirmFmTicketReassignment(ticket.assignee, payload.assignee) &&
      !window.confirm(FM_TICKET_REASSIGNMENT_CONFIRMATION)
    ) {
      return;
    }
    setValidationError(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    mutation.mutate(payload);
  }

  return (
    <SectionCard
      title="Assignment"
      description="Assign an active technician from the ticket tenant. Backend authorization remains authoritative."
    >
      <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DetailField
          label="Current technician"
          value={formatPersonLabel(ticket.assignee_email)}
        />
        <DetailField
          label="Assignment status"
          value={getFmTicketAssignmentStatusLabel(ticket.assignee)}
        />
      </dl>

      {assignmentState === "read_only" ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="font-medium text-slate-900">Assignment is view only</p>
          <p className="mt-1 text-sm text-slate-700">
            You can see the current technician, but you do not have permission to
            assign or reassign this ticket.
          </p>
        </div>
      ) : null}

      {assignmentState === "directory_unavailable" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-950">
            Technician selection requires directory access
          </p>
          <p className="mt-1 text-sm text-amber-800">
            You have assignment permission, but technician selection is unavailable
            without user directory access. Ask an administrator to grant directory
            access for assignment workflows.
          </p>
        </div>
      ) : null}

      {assignmentState === "ready" ? (
        <div className="space-y-4">
          <UserDirectoryPicker
            allowClear={false}
            description="Active users in this ticket tenant. Backend role and tenant checks remain authoritative."
            disabled={mutation.isPending}
            error={validationError ?? undefined}
            label="Technician"
            onChange={(value) => {
              setValidationError(null);
              setSelectedAssignee(value);
            }}
            organization={ticket.organization}
            permissionEnabled={canReadDirectory}
            placeholder="Select a technician"
            required
            selectedUser={buildFmTicketAssigneeFallback(ticket)}
            tenant={ticket.tenant}
            value={selectedAssignee}
          />
          <FormField
            description="Optional note recorded with the assignment."
            htmlFor="fm-ticket-assign-note"
            label="Assignment note"
          >
            <textarea
              className="block min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              disabled={mutation.isPending}
              id="fm-ticket-assign-note"
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </FormField>
          <button
            className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={mutation.isPending}
            onClick={handleAssign}
            type="button"
          >
            {mutation.isPending
              ? "Saving..."
              : getFmTicketAssignmentActionLabel(ticket.assignee)}
          </button>
        </div>
      ) : null}

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
