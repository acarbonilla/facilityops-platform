import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type { PaginatedResponse } from "@/services/api/types";
import type {
  InspectionAIAnalysis,
  InspectionAttachment,
  InspectionComment,
  InspectionCorrectiveAction,
  InspectionDetail,
  InspectionFinding,
  InspectionHistory,
  InspectionItem,
  InspectionListItem,
  InspectionListParams,
} from "@/types/inspection";

function normalizeAiAnalysis(
  payload: InspectionAIAnalysis | Record<string, never>,
): InspectionAIAnalysis | null {
  if (typeof payload === "object" && payload !== null && "id" in payload) {
    return payload as InspectionAIAnalysis;
  }

  return null;
}

export function getInspectionList(
  params?: InspectionListParams,
): Promise<PaginatedResponse<InspectionListItem>> {
  return apiClient<PaginatedResponse<InspectionListItem>>(
    API_ENDPOINTS.inspection.inspections,
    {
      method: "GET",
      query: params,
    },
  );
}

export function getInspectionDetail(id: string): Promise<InspectionDetail> {
  return apiClient<InspectionDetail>(API_ENDPOINTS.inspection.inspection(id), {
    method: "GET",
  });
}

export function getInspectionItems(
  id: string,
): Promise<PaginatedResponse<InspectionItem>> {
  return apiClient<PaginatedResponse<InspectionItem>>(
    API_ENDPOINTS.inspection.items(id),
    {
      method: "GET",
    },
  );
}

export function getInspectionFindings(
  id: string,
): Promise<PaginatedResponse<InspectionFinding>> {
  return apiClient<PaginatedResponse<InspectionFinding>>(
    API_ENDPOINTS.inspection.findings(id),
    {
      method: "GET",
    },
  );
}

export function getInspectionAttachments(
  id: string,
): Promise<PaginatedResponse<InspectionAttachment>> {
  return apiClient<PaginatedResponse<InspectionAttachment>>(
    API_ENDPOINTS.inspection.attachments(id),
    {
      method: "GET",
    },
  );
}

export function getInspectionComments(
  id: string,
): Promise<PaginatedResponse<InspectionComment>> {
  return apiClient<PaginatedResponse<InspectionComment>>(
    API_ENDPOINTS.inspection.comments(id),
    {
      method: "GET",
    },
  );
}

export function getInspectionHistory(
  id: string,
): Promise<PaginatedResponse<InspectionHistory>> {
  return apiClient<PaginatedResponse<InspectionHistory>>(
    API_ENDPOINTS.inspection.history(id),
    {
      method: "GET",
    },
  );
}

export function getInspectionCorrectiveActions(
  id: string,
): Promise<PaginatedResponse<InspectionCorrectiveAction>> {
  return apiClient<PaginatedResponse<InspectionCorrectiveAction>>(
    API_ENDPOINTS.inspection.correctiveActions(id),
    {
      method: "GET",
    },
  );
}

export async function getInspectionAIAnalysis(
  id: string,
): Promise<InspectionAIAnalysis | null> {
  const payload = await apiClient<InspectionAIAnalysis | Record<string, never>>(
    API_ENDPOINTS.inspection.aiAnalysis(id),
    {
      method: "GET",
    },
  );
  return normalizeAiAnalysis(payload);
}
