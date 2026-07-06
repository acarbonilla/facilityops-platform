import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type { PaginatedResponse } from "@/services/api/types";
import type {
  FmTicketComment,
  FmTicketDetail,
  FmTicketHistory,
  FmTicketListItem,
  FmTicketListParams,
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
