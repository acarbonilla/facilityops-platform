import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type {
  AIAdminAuditEntry,
  AIAdminConfig,
  AIAdminConfigPatch,
  AIAdminHealth,
  AIAdminPolicy,
  AIAdminPrompt,
} from "@/types/ai-administration";

export function getAIAdminConfig(): Promise<AIAdminConfig> {
  return apiClient<AIAdminConfig>(API_ENDPOINTS.adminAi.config, {
    method: "GET",
  });
}

export function patchAIAdminConfig(
  payload: AIAdminConfigPatch,
): Promise<AIAdminConfig> {
  return apiClient<AIAdminConfig>(API_ENDPOINTS.adminAi.config, {
    method: "PATCH",
    body: payload,
  });
}

export function getAIAdminPrompts(): Promise<{
  prompts: AIAdminPrompt[];
  editable: boolean;
  prompt_text_exposed: boolean;
  note?: string;
}> {
  return apiClient(API_ENDPOINTS.adminAi.prompts, { method: "GET" });
}

export function getAIAdminPolicies(): Promise<{
  policies: AIAdminPolicy[];
  editable: boolean;
}> {
  return apiClient(API_ENDPOINTS.adminAi.policies, { method: "GET" });
}

export function getAIAdminHealth(): Promise<AIAdminHealth> {
  return apiClient<AIAdminHealth>(API_ENDPOINTS.adminAi.health, {
    method: "GET",
  });
}

export function getAIAdminAudit(limit = 50): Promise<{
  entries: AIAdminAuditEntry[];
  count: number;
}> {
  return apiClient(API_ENDPOINTS.adminAi.audit, {
    method: "GET",
    query: { limit },
  });
}
