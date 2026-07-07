"use client";

import { useQuery } from "@tanstack/react-query";

import { getInspectionList } from "@/services/api/inspection";
import { inspectionQueryKeys } from "@/services/api/query-keys";
import type { InspectionListParams } from "@/types/inspection";

export function useInspectionList(params?: InspectionListParams) {
  return useQuery({
    queryKey: inspectionQueryKeys.list(params),
    queryFn: () => getInspectionList(params),
  });
}
