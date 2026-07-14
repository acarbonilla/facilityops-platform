"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  fmTicketsQueryKeys,
  maintenanceQueryKeys,
  notificationQueryKeys,
} from "@/services/api/query-keys";

import { shouldInvalidateLinkedTicket } from "@/lib/maintenance/ticket-sync";

type WorkflowMutationOptions = {
  sourceTicketId?: string | null;
};

export function useMaintenanceWorkflowMutation<TPayload>(
  id: string,
  mutationFn: (payload: TPayload) => Promise<unknown>,
  options?: WorkflowMutationOptions,
) {
  const queryClient = useQueryClient();
  const sourceTicketId = options?.sourceTicketId ?? null;

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: maintenanceQueryKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: maintenanceQueryKeys.detail(id),
        }),
        queryClient.invalidateQueries({
          queryKey: maintenanceQueryKeys.history(id),
        }),
        queryClient.invalidateQueries({
          queryKey: maintenanceQueryKeys.assignments(id),
        }),
        queryClient.invalidateQueries({
          queryKey: maintenanceQueryKeys.sla(id),
        }),
        queryClient.invalidateQueries({
          queryKey: maintenanceQueryKeys.escalations(id),
        }),
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.all,
        }),
      ];

      if (shouldInvalidateLinkedTicket(sourceTicketId)) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: fmTicketsQueryKeys.detail(sourceTicketId as string),
          }),
          queryClient.invalidateQueries({
            queryKey: fmTicketsQueryKeys.history(sourceTicketId as string),
          }),
          queryClient.invalidateQueries({
            queryKey: fmTicketsQueryKeys.all,
          }),
        );
      }

      await Promise.all(invalidations);
    },
  });
}
