"use client";

import { useQuery } from "@tanstack/react-query";

import {
  acknowledgeWorkOrderEscalation,
  getWorkOrderEscalations,
  resolveWorkOrderEscalation,
} from "@/services/api/maintenance";
import { maintenanceQueryKeys } from "@/services/api/query-keys";
import type { MaintenanceEscalationActionPayload } from "@/types/maintenance";

import { useMaintenanceWorkflowMutation } from "./use-maintenance-workflow-mutation";

export function useWorkOrderEscalations(id: string, enabled = true) {
  return useQuery({
    queryKey: maintenanceQueryKeys.escalations(id),
    queryFn: () => getWorkOrderEscalations(id),
    enabled,
  });
}

interface EscalationMutationPayload extends MaintenanceEscalationActionPayload {
  escalationId: string;
}

export function useAcknowledgeWorkOrderEscalation(id: string) {
  return useMaintenanceWorkflowMutation<EscalationMutationPayload>(id, (payload) =>
    acknowledgeWorkOrderEscalation(id, payload.escalationId, {
      notes: payload.notes,
    }),
  );
}

export function useResolveWorkOrderEscalation(id: string) {
  return useMaintenanceWorkflowMutation<EscalationMutationPayload>(id, (payload) =>
    resolveWorkOrderEscalation(id, payload.escalationId, {
      notes: payload.notes,
    }),
  );
}
