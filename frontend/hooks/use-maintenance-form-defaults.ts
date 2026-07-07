"use client";

import { useMemo } from "react";

import {
  buildMaintenanceFormDefaults,
  mapMaintenanceDetailToFormValues,
} from "@/lib/maintenance/form";
import type {
  MaintenanceWorkOrderDetail,
  MaintenanceWorkOrderFormValues,
} from "@/types/maintenance";

import { useAuth } from "./use-auth";

export function useMaintenanceFormDefaults(
  detail?: MaintenanceWorkOrderDetail | null,
): MaintenanceWorkOrderFormValues {
  const { user } = useAuth();

  return useMemo(() => {
    if (detail) {
      return mapMaintenanceDetailToFormValues(detail);
    }

    return buildMaintenanceFormDefaults(user);
  }, [detail, user]);
}
