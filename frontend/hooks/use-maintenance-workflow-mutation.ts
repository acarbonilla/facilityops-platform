"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { maintenanceQueryKeys } from "@/services/api/query-keys";

export function useMaintenanceWorkflowMutation<TPayload>(
  id: string,
  mutationFn: (payload: TPayload) => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
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
      ]);
    },
  });
}
