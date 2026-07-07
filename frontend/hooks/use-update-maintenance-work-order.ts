"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateMaintenanceWorkOrder } from "@/services/api/maintenance";
import { maintenanceQueryKeys } from "@/services/api/query-keys";
import type { MaintenanceWorkOrderUpdatePayload } from "@/types/maintenance";

export function useUpdateMaintenanceWorkOrder(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MaintenanceWorkOrderUpdatePayload) =>
      updateMaintenanceWorkOrder(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: maintenanceQueryKeys.all,
      });
      await queryClient.invalidateQueries({
        queryKey: maintenanceQueryKeys.detail(id),
      });
    },
  });
}
