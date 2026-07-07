"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createMaintenanceWorkOrder } from "@/services/api/maintenance";
import { maintenanceQueryKeys } from "@/services/api/query-keys";
import type { MaintenanceWorkOrderCreatePayload } from "@/types/maintenance";

export function useCreateMaintenanceWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MaintenanceWorkOrderCreatePayload) =>
      createMaintenanceWorkOrder(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: maintenanceQueryKeys.all,
      });
    },
  });
}
