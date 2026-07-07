"use client";

import { useMemo } from "react";

import {
  buildInspectionFormDefaults,
  mapInspectionDetailToFormValues,
} from "@/lib/inspection/form";
import type { InspectionDetail, InspectionFormValues } from "@/types/inspection";

import { useAuth } from "./use-auth";

export function useInspectionFormDefaults(
  detail?: InspectionDetail | null,
): InspectionFormValues {
  const { user } = useAuth();

  return useMemo(() => {
    if (detail) {
      return mapInspectionDetailToFormValues(detail);
    }

    return buildInspectionFormDefaults(user);
  }, [detail, user]);
}
