"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getWorkOrderAssignmentCandidates,
  getWorkOrderAssignments,
} from "@/services/api/maintenance";
import { maintenanceQueryKeys } from "@/services/api/query-keys";

export function useWorkOrderAssignments(id: string, enabled = true) {
  return useQuery({
    queryKey: maintenanceQueryKeys.assignments(id),
    queryFn: () => getWorkOrderAssignments(id),
    enabled,
  });
}

export function useWorkOrderAssignmentCandidates(id: string, enabled = true) {
  return useQuery({
    queryKey: maintenanceQueryKeys.assignmentCandidates(id),
    queryFn: () => getWorkOrderAssignmentCandidates(id),
    enabled,
  });
}
