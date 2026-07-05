import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type { FoundationSummary } from "@/types/dashboard";

function normalizeCount(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid dashboard count received for ${key}.`);
  }

  return value;
}

export async function getFoundationSummary(): Promise<FoundationSummary> {
  const payload = await apiClient<Record<string, unknown>>(
    API_ENDPOINTS.dashboard.foundationSummary,
    {
      method: "GET",
    },
  );

  if (typeof payload.service !== "string" || payload.service.length === 0) {
    throw new Error("The backend returned an invalid dashboard service name.");
  }

  return {
    tenants: normalizeCount(payload.tenants, "tenants"),
    organizations: normalizeCount(payload.organizations, "organizations"),
    departments: normalizeCount(payload.departments, "departments"),
    buildings: normalizeCount(payload.buildings, "buildings"),
    floors: normalizeCount(payload.floors, "floors"),
    areas: normalizeCount(payload.areas, "areas"),
    asset_types: normalizeCount(payload.asset_types, "asset_types"),
    assets: normalizeCount(payload.assets, "assets"),
    service: payload.service,
  };
}
