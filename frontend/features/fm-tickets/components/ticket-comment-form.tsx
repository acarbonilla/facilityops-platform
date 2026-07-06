"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ErrorState } from "@/components/common/error-state";
import { FormActions } from "@/components/common/form-actions";
import { SwitchField } from "@/components/common/switch-field";
import { fmTicketCommentSchema } from "@/lib/validations/fm-tickets";
import { createFmTicketComment } from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys } from "@/services/api/query-keys";
import type { FmTicketCommentCreatePayload } from "@/types/fm-tickets";

import { SectionCard } from "./ticket-shared";
import { TextAreaField } from "@/features/master-data/components/shared";

export function TicketCommentForm({ ticketId }: { ticketId: string }) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<FmTicketCommentCreatePayload>({
    resolver: zodResolver(fmTicketCommentSchema),
    defaultValues: {
      body: "",
      is_internal: false,
    },
  });
  const mutation = useMutation({
    mutationFn: (payload: FmTicketCommentCreatePayload) =>
      createFmTicketComment(ticketId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.detail(ticketId),
        }),
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.comments(ticketId),
        }),
        queryClient.invalidateQueries({
          queryKey: fmTicketsQueryKeys.history(ticketId),
        }),
      ]);
      reset({
        body: "",
        is_internal: false,
      });
      setSuccessMessage("Comment added successfully.");
    },
  });

  return (
    <SectionCard
      title="Add Comment"
      description="Add a new ticket comment. Successful submissions refresh the ticket detail, comments, and history sections."
    >
      {mutation.isError ? (
        <ErrorState
          title="Unable to add comment"
          message={
            mutation.error instanceof Error
              ? mutation.error.message
              : "The comment could not be submitted."
          }
        />
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-medium text-emerald-950">Comment saved</p>
          <p className="mt-1 text-sm text-emerald-800">{successMessage}</p>
        </div>
      ) : null}

      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setSuccessMessage(null);
          await mutation.mutateAsync({
            body: values.body.trim(),
            is_internal: values.is_internal ?? false,
          });
        })}
      >
        <TextAreaField
          description="Write a practical update for the ticket timeline."
          error={errors.body?.message}
          id="ticket-comment-body"
          label="Comment"
          textAreaProps={register("body")}
        />
        <SwitchField
          description="Internal comments stay tagged as internal in the ticket history."
          error={errors.is_internal?.message}
          label="Internal comment"
          {...register("is_internal")}
        />
        <FormActions
          cancelHref={`/fm-tickets/${ticketId}`}
          isSubmitting={mutation.isPending}
          submitLabel="Add comment"
        />
      </form>
    </SectionCard>
  );
}
