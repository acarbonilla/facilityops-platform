import type { MyRequestListParams } from "@/types/my-requests";

import { normalizeMyRequestListParams } from "./form";

/**
 * Query keys for Employee My Requests.
 * Session isolation relies on clearSessionQueryCache at auth boundaries
 * (same architecture as FM Tickets). Optional sessionScope supports tests
 * and future keyed separation without changing the clear-on-switch contract.
 */
export const myRequestsQueryKeys = {
  all: (sessionScope?: string) =>
    sessionScope
      ? (["my-requests", sessionScope] as const)
      : (["my-requests"] as const),
  myRequests: (sessionScope?: string) => myRequestsQueryKeys.all(sessionScope),
  myRequestList: (params?: MyRequestListParams, sessionScope?: string) =>
    [
      ...myRequestsQueryKeys.all(sessionScope),
      "list",
      normalizeMyRequestListParams(params),
    ] as const,
  myRequestDetail: (id: string, sessionScope?: string) =>
    [...myRequestsQueryKeys.all(sessionScope), "detail", id] as const,
  myRequestOptions: (sessionScope?: string) =>
    [...myRequestsQueryKeys.all(sessionScope), "options"] as const,
};
