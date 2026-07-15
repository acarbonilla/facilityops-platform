import { createUserDirectoryEmailFallback } from "@/lib/users/directory";
import type {
  FmTicketAssignmentPayload,
  FmTicketDetail,
} from "@/types/fm-tickets";
import type { UserDirectoryItem } from "@/types/users";

export type FmTicketAssignmentCapabilityState =
  | "read_only"
  | "directory_unavailable"
  | "ready";

export function resolveFmTicketAssignmentState(args: {
  canAssign: boolean;
  canReadDirectory: boolean;
}): FmTicketAssignmentCapabilityState {
  if (!args.canAssign) {
    return "read_only";
  }
  if (!args.canReadDirectory) {
    return "directory_unavailable";
  }
  return "ready";
}

export function getFmTicketAssignmentActionLabel(
  currentAssigneeId?: string | null,
): string {
  return currentAssigneeId ? "Reassign Ticket" : "Assign Ticket";
}

export function getFmTicketAssignmentStatusLabel(
  currentAssigneeId?: string | null,
): string {
  return currentAssigneeId ? "Assigned" : "Unassigned";
}

export function buildFmTicketAssigneeFallback(
  ticket: Pick<FmTicketDetail, "assignee" | "assignee_email">,
): UserDirectoryItem | null {
  return createUserDirectoryEmailFallback(ticket.assignee, ticket.assignee_email);
}

export function normalizeFmTicketAssigneeId(value?: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function buildFmTicketAssignmentPayload(
  assigneeId: string | null | undefined,
  note = "",
): FmTicketAssignmentPayload | null {
  const assignee = normalizeFmTicketAssigneeId(assigneeId);
  if (!assignee) {
    return null;
  }
  const trimmedNote = note.trim();
  return trimmedNote
    ? { assignee, note: trimmedNote }
    : { assignee };
}

export function formatFmTicketAssignmentError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Unable to assign this ticket right now.";
}

export function formatFmTicketAssignmentSuccess(assigneeEmail?: string | null): string {
  if (assigneeEmail) {
    return `Ticket assigned to ${assigneeEmail}.`;
  }
  return "Ticket assigned successfully.";
}

export function shouldConfirmFmTicketReassignment(
  currentAssigneeId: string | null | undefined,
  nextAssigneeId: string | null | undefined,
): boolean {
  const current = normalizeFmTicketAssigneeId(currentAssigneeId);
  const next = normalizeFmTicketAssigneeId(nextAssigneeId);
  return Boolean(current && next && current !== next);
}

export const FM_TICKET_REASSIGNMENT_CONFIRMATION =
  "Reassign this ticket to a different technician? The previous assignee will no longer be the active technician.";
