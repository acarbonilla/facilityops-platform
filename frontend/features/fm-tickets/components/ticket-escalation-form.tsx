"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { SelectField } from "@/components/common/select-field";
import { ErrorState } from "@/components/common/error-state";
import { FormActions } from "@/components/common/form-actions";
import { TextAreaField } from "@/features/master-data/components/shared";
import { fmTicketEscalationSchema } from "@/lib/validations/fm-tickets";
import { escalateFmTicket } from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys } from "@/services/api/query-keys";
import type { FmTicketDetail, FmTicketEscalationPayload } from "@/types/fm-tickets";

import { SectionCard, formatPersonLabel } from "./ticket-shared";

const ESCALATION_LEVEL_OPTIONS = [
  { value: "level_1", label: "Level 1" },
  { value: "level_2", label: "Level 2" },
  { value: "level_3", label: "Level 3" },
  { value: "management", label: "Management" },
] as const;

export function TicketEscalationForm({ ticket }: { ticket: FmTicketDetail }) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<FmTicketEscalationPayload>({
    resolver: zodResolver(fmTicketEscalationSchema),
    defaultValues: {
      escalated_to: ticket.assignee ?? undefined,
      reason: "",
      level: "level_1",
    },
  });
  const mutation = useMutation({
    mutationFn: (payload: FmTicketEscalationPayload) => escalateFmTicket(ticket.id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.detail(ticket.id),
        }),
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.history(ticket.id),
        }),
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.escalations(ticket.id),
        }),
      ]);
      reset({
        escalated_to: ticket.assignee ?? undefined,
        reason: "",
        level: "level_1",
      });
      setSuccessMessage("Escalation recorded successfully.");
    },
  });

  return (
    <SectionCard
      title="Manual Escalation"
      description="Create a manual escalation record without notifications or automated follow-up jobs."
    >
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Escalation target</p>
        <p className="mt-1">
          New escalations default to the current assignee:
          {" "}
          {formatPersonLabel(ticket.assignee_email)}
        </p>
      </div>

      {mutation.isError ? (
        <ErrorState
          title="Unable to create escalation"
          message={
            mutation.error instanceof Error
              ? mutation.error.message
              : "The escalation could not be submitted."
          }
        />
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-medium text-emerald-950">Escalation saved</p>
          <p className="mt-1 text-sm text-emerald-800">{successMessage}</p>
        </div>
      ) : null}

      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setSuccessMessage(null);
          await mutation.mutateAsync({
            escalated_to: ticket.assignee ?? undefined,
            reason: values.reason.trim(),
            level: values.level,
          });
        })}
      >
        <SelectField
          error={errors.level?.message}
          label="Escalation level"
          options={ESCALATION_LEVEL_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          {...register("level")}
        />
        <TextAreaField
          description="Capture the reason for raising this ticket beyond its current workflow."
          error={errors.reason?.message}
          id="ticket-escalation-reason"
          label="Reason"
          textAreaProps={register("reason")}
        />
        <FormActions
          cancelHref={`/fm-tickets/${ticket.id}`}
          isSubmitting={mutation.isPending}
          submitLabel="Create escalation"
        />
      </form>
    </SectionCard>
  );
}
