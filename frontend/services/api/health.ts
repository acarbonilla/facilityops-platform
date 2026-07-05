import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";
import type { HealthCheckResponse } from "./types";

export function getBackendHealth(): Promise<HealthCheckResponse> {
  return apiClient<HealthCheckResponse>(API_ENDPOINTS.health, {
    method: "GET",
  });
}
