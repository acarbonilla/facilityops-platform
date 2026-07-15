import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type { PaginatedResponse } from "@/services/api/types";
import type {
  FmTicketAssignmentPayload,
  FmTicketAssignmentResponse,
  FmTicketComment,
  FmTicketCommentCreatePayload,
  FmTicketCreatePayload,
  FmTicketDetail,
  FmTicketEscalation,
  FmTicketEscalationPayload,
  FmTicketHistory,
  FmTicketListItem,
  FmTicketListParams,
  FmTicketStatusUpdatePayload,
  FmTicketUpdatePayload,
  GeneratedWorkOrderSummary,
} from "@/types/fm-tickets";

export function getFmTickets(
  params?: FmTicketListParams,
): Promise<PaginatedResponse<FmTicketListItem>> {
  return apiClient<PaginatedResponse<FmTicketListItem>>(
    API_ENDPOINTS.fmTickets.tickets,
    {
      method: "GET",
      query: params,
    },
  );
}

export function getFmTicket(id: string): Promise<FmTicketDetail> {
  return apiClient<FmTicketDetail>(API_ENDPOINTS.fmTickets.ticket(id), {
    method: "GET",
  });
}

export function createFmTicket(
  payload: FmTicketCreatePayload,
): Promise<FmTicketDetail> {
  return apiClient<FmTicketDetail>(API_ENDPOINTS.fmTickets.tickets, {
    method: "POST",
    body: payload,
  });
}

export function updateFmTicket(
  id: string,
  payload: FmTicketUpdatePayload,
): Promise<FmTicketDetail> {
  return apiClient<FmTicketDetail>(API_ENDPOINTS.fmTickets.ticket(id), {
    method: "PATCH",
    body: payload,
  });
}

export function getFmTicketComments(
  ticketId: string,
): Promise<PaginatedResponse<FmTicketComment>> {
  return apiClient<PaginatedResponse<FmTicketComment>>(
    API_ENDPOINTS.fmTickets.comments(ticketId),
    {
      method: "GET",
    },
  );
}

export function createFmTicketComment(
  ticketId: string,
  payload: FmTicketCommentCreatePayload,
): Promise<FmTicketComment> {
  return apiClient<FmTicketComment>(API_ENDPOINTS.fmTickets.comments(ticketId), {
    method: "POST",
    body: payload,
  });
}

export function getFmTicketHistory(
  ticketId: string,
): Promise<PaginatedResponse<FmTicketHistory>> {
  return apiClient<PaginatedResponse<FmTicketHistory>>(
    API_ENDPOINTS.fmTickets.history(ticketId),
    {
      method: "GET",
    },
  );
}

export function getFmTicketEscalations(
  ticketId: string,
): Promise<PaginatedResponse<FmTicketEscalation>> {
  return apiClient<PaginatedResponse<FmTicketEscalation>>(
    API_ENDPOINTS.fmTickets.escalations(ticketId),
    {
      method: "GET",
    },
  );
}

export function escalateFmTicket(
  ticketId: string,
  payload: FmTicketEscalationPayload,
): Promise<FmTicketEscalation> {
  return apiClient<FmTicketEscalation>(API_ENDPOINTS.fmTickets.escalate(ticketId), {
    method: "POST",
    body: {
      escalated_to: payload.escalated_to ?? null,
      reason: payload.reason,
      level: payload.level,
    },
  });
}

export function assignFmTicket(
  ticketId: string,
  payload: FmTicketAssignmentPayload,
): Promise<FmTicketAssignmentResponse> {
  return apiClient<FmTicketAssignmentResponse>(
    API_ENDPOINTS.fmTickets.assign(ticketId),
    {
      method: "POST",
      body: {
        assignee: payload.assignee,
        note: payload.note ?? "",
      },
    },
  );
}

export function changeFmTicketStatus(
  ticketId: string,
  payload: FmTicketStatusUpdatePayload,
): Promise<FmTicketDetail> {
  return apiClient<FmTicketDetail>(API_ENDPOINTS.fmTickets.changeStatus(ticketId), {
    method: "POST",
    body: {
      status: payload.to_status,
      note: payload.note ?? "",
    },
  });
}

export function generateWorkOrderFromTicket(
  ticketId: string,
): Promise<GeneratedWorkOrderSummary> {
  return apiClient<GeneratedWorkOrderSummary>(
    API_ENDPOINTS.fmTickets.generateWorkOrder(ticketId),
    {
      method: "POST",
      body: {},
    },
  );
}
