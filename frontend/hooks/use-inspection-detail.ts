"use client";

import { useQuery } from "@tanstack/react-query";

import { getInspectionDetail } from "@/services/api/inspection";
import { inspectionQueryKeys } from "@/services/api/query-keys";

export function useInspectionDetail(id: string) {
  return useQuery({
    queryKey: inspectionQueryKeys.detail(id),
    queryFn: () => getInspectionDetail(id),
    enabled: Boolean(id),
  });
}
