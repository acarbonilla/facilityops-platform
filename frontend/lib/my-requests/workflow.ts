import type {
  MyRequestDetail,
  MyRequestWorkflowAction,
  MyRequestWorkflowEligibility,
} from "@/types/my-requests";
import { myRequestsQueryKeys } from "./query-keys";

export function resolveMyRequestWorkflowEligibility(
  detail?: Pick<
    MyRequestDetail,
    "status" | "can_cancel" | "can_acknowledge" | "can_reopen"
  > | null,
): MyRequestWorkflowEligibility {
  if (!detail) {
    return {
      canCancel: false,
      canAcknowledge: false,
      canReopen: false,
    };
  }

  return {
    canCancel: Boolean(detail.can_cancel),
    canAcknowledge: Boolean(detail.can_acknowledge),
    canReopen: Boolean(detail.can_reopen),
  };
}

export function requiresWorkflowReason(action: MyRequestWorkflowAction): boolean {
  return action === "cancel" || action === "reopen";
}

export function validateWorkflowReason(
  action: MyRequestWorkflowAction,
  reason: string,
): string | null {
  if (!requiresWorkflowReason(action)) {
    return null;
  }
  if (!reason.trim()) {
    return "A reason is required.";
  }
  return null;
}

export function buildMyRequestCancelPayload(reason: string): { reason: string } | null {
  const normalized = reason.trim();
  if (!normalized) {
    return null;
  }
  return { reason: normalized };
}

export function buildMyRequestReopenPayload(reason: string): { reason: string } | null {
  return buildMyRequestCancelPayload(reason);
}

export function buildMyRequestAcknowledgePayload(): Record<string, never> {
  return {};
}

export function getWorkflowActionLabel(action: MyRequestWorkflowAction): string {
  switch (action) {
    case "cancel":
      return "Cancel request";
    case "acknowledge":
      return "Acknowledge resolution";
    case "reopen":
      return "Reopen request";
  }
}

export function getWorkflowSuccessMessage(action: MyRequestWorkflowAction): string {
  switch (action) {
    case "cancel":
      return "Your request was cancelled.";
    case "acknowledge":
      return "Resolution acknowledged. Your request is now closed.";
    case "reopen":
      return "Your request was reopened for facilities follow-up.";
  }
}

export function getWorkflowConfirmationCopy(action: MyRequestWorkflowAction): {
  title: string;
  description: string;
  confirmLabel: string;
} {
  switch (action) {
    case "cancel":
      return {
        title: "Cancel this request?",
        description:
          "Cancelling stops facilities work on this request. Provide a short reason.",
        confirmLabel: "Confirm cancellation",
      };
    case "acknowledge":
      return {
        title: "Acknowledge resolution?",
        description:
          "Confirm that the facilities team has resolved this request. It will be closed.",
        confirmLabel: "Acknowledge and close",
      };
    case "reopen":
      return {
        title: "Reopen this request?",
        description:
          "Reopening returns the request to facilities for additional work. Provide a reason.",
        confirmLabel: "Confirm reopen",
      };
  }
}

/** Map operational FM Ticket notification targets to My Requests for Employee mode. */
export function mapRequesterNotificationTarget(
  targetUrl: string | null | undefined,
  isRequesterMode: boolean,
): string | null {
  if (!targetUrl) {
    return null;
  }

  if (!isRequesterMode) {
    return targetUrl;
  }

  const match = targetUrl.match(
    /^\/fm-tickets\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i,
  );
  if (match) {
    return `/my-requests/${match[1]}`;
  }

  return targetUrl;
}

export function getMyRequestWorkflowInvalidationKeys(id: string): readonly (readonly unknown[])[] {
  return [
    myRequestsQueryKeys.myRequests(),
    myRequestsQueryKeys.myRequestDetail(id),
    myRequestsQueryKeys.myRequestList(),
    ["notifications"],
    ["fm-tickets"],
  ];
}
