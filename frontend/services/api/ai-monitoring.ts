import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type { AIMonitoringOverview } from "@/types/ai-monitoring";

export function getAIMonitoringOverview(): Promise<AIMonitoringOverview> {
  return apiClient<AIMonitoringOverview>(API_ENDPOINTS.adminAi.monitoring, {
    method: "GET",
  });
}

export function getAIMonitoringRuntime(): Promise<{
  runtime: AIMonitoringOverview["runtime"];
  error_categories: Record<string, number>;
}> {
  return apiClient(API_ENDPOINTS.adminAi.monitoringRuntime, { method: "GET" });
}

export function getAIMonitoringQueue(): Promise<{
  queue: AIMonitoringOverview["queue"];
  recent_activity: AIMonitoringOverview["recent_activity"];
}> {
  return apiClient(API_ENDPOINTS.adminAi.monitoringQueue, { method: "GET" });
}

export function getAIMonitoringAlerts(): Promise<{
  health: AIMonitoringOverview["health"];
  alerts: AIMonitoringOverview["alerts"];
  remediation: { automatic: boolean; note?: string };
}> {
  return apiClient(API_ENDPOINTS.adminAi.monitoringAlerts, { method: "GET" });
}
