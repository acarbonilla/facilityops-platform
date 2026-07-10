import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type { PaginatedResponse } from "@/services/api/types";
import type {
  InspectionAIAnalysis,
  InspectionAttachment,
  InspectionAssignPayload,
  InspectionAIAnalysisPayload,
  InspectionCancelPayload,
  InspectionComment,
  InspectionCorrectiveActionCreatePayload,
  InspectionCorrectiveActionUpdatePayload,
  InspectionCreatePayload,
  InspectionCorrectiveAction,
  InspectionDetail,
  InspectionFindingCreatePayload,
  InspectionFindingUpdatePayload,
  InspectionFinding,
  InspectionHistory,
  InspectionItem,
  InspectionListItem,
  InspectionListParams,
  InspectionReopenPayload,
  InspectionSimpleWorkflowPayload,
  InspectionUpdatePayload,
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

export function createInspection(
  payload: InspectionCreatePayload,
): Promise<InspectionDetail> {
  return apiClient<InspectionDetail>(API_ENDPOINTS.inspection.inspections, {
    method: "POST",
    body: payload,
  });
}

export function updateInspection(
  id: string,
  payload: InspectionUpdatePayload,
): Promise<InspectionDetail> {
  return apiClient<InspectionDetail>(API_ENDPOINTS.inspection.inspection(id), {
    method: "PATCH",
    body: payload,
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

export async function saveInspectionAIAnalysis(
  id: string,
  payload: InspectionAIAnalysisPayload,
): Promise<InspectionAIAnalysis> {
  const response = await apiClient<InspectionAIAnalysis | Record<string, never>>(
    API_ENDPOINTS.inspection.aiAnalysis(id),
    {
      method: "POST",
      body: payload,
    },
  );

  const normalized = normalizeAiAnalysis(response);
  if (!normalized) {
    throw new Error("The backend did not return a saved AI analysis record.");
  }

  return normalized;
}

export function assignInspection(
  id: string,
  payload: InspectionAssignPayload,
): Promise<InspectionDetail> {
  return apiClient<InspectionDetail>(API_ENDPOINTS.inspection.assign(id), {
    method: "POST",
    body: payload,
  });
}

export function startInspection(
  id: string,
  payload?: InspectionSimpleWorkflowPayload,
): Promise<InspectionDetail> {
  return apiClient<InspectionDetail>(API_ENDPOINTS.inspection.start(id), {
    method: "POST",
    body: payload,
  });
}

export function completeInspection(
  id: string,
  payload?: InspectionSimpleWorkflowPayload,
): Promise<InspectionDetail> {
  return apiClient<InspectionDetail>(API_ENDPOINTS.inspection.complete(id), {
    method: "POST",
    body: payload,
  });
}

export function verifyInspection(
  id: string,
  payload?: InspectionSimpleWorkflowPayload,
): Promise<InspectionDetail> {
  return apiClient<InspectionDetail>(API_ENDPOINTS.inspection.verify(id), {
    method: "POST",
    body: payload,
  });
}

export function cancelInspection(
  id: string,
  payload: InspectionCancelPayload,
): Promise<InspectionDetail> {
  return apiClient<InspectionDetail>(API_ENDPOINTS.inspection.cancel(id), {
    method: "POST",
    body: payload,
  });
}

export function reopenInspection(
  id: string,
  payload: InspectionReopenPayload,
): Promise<InspectionDetail> {
  return apiClient<InspectionDetail>(API_ENDPOINTS.inspection.reopen(id), {
    method: "POST",
    body: payload,
  });
}

export function createInspectionFinding(
  payload: InspectionFindingCreatePayload,
): Promise<InspectionFinding> {
  return apiClient<InspectionFinding>(API_ENDPOINTS.inspection.findingsCollection, {
    method: "POST",
    body: payload,
  });
}

export function updateInspectionFinding(
  id: string,
  payload: InspectionFindingUpdatePayload,
): Promise<InspectionFinding> {
  return apiClient<InspectionFinding>(API_ENDPOINTS.inspection.finding(id), {
    method: "PATCH",
    body: payload,
  });
}

export function deleteInspectionFinding(id: string): Promise<void> {
  return apiClient<void>(API_ENDPOINTS.inspection.finding(id), {
    method: "DELETE",
  });
}

export function createInspectionCorrectiveAction(
  payload: InspectionCorrectiveActionCreatePayload,
): Promise<InspectionCorrectiveAction> {
  return apiClient<InspectionCorrectiveAction>(
    API_ENDPOINTS.inspection.correctiveActionsCollection,
    {
      method: "POST",
      body: payload,
    },
  );
}

export function updateInspectionCorrectiveAction(
  id: string,
  payload: InspectionCorrectiveActionUpdatePayload,
): Promise<InspectionCorrectiveAction> {
  return apiClient<InspectionCorrectiveAction>(
    API_ENDPOINTS.inspection.correctiveAction(id),
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function deleteInspectionCorrectiveAction(id: string): Promise<void> {
  return apiClient<void>(API_ENDPOINTS.inspection.correctiveAction(id), {
    method: "DELETE",
  });
}
