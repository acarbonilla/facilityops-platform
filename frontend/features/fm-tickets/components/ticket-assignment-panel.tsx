"use client";

import { DetailField } from "@/components/common/detail-field";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getUserManagementCapabilities,
  getUserManagementEndpointDiscovery,
} from "@/services/api/users";
import type {
  FmTicketAssignmentState,
  FmTicketDetail,
} from "@/types/fm-tickets";

import { SectionCard, formatPersonLabel } from "./ticket-shared";

const FM_TICKET_ASSIGNMENT_ENDPOINT = "/api/fm-tickets/tickets/{id}/assign/";

function buildAssignmentState(args: {
  canAssign: boolean;
  hasUserListEndpoint: boolean;
}): FmTicketAssignmentState {
  if (!args.canAssign) {
    return "read_only";
  }

  if (!args.hasUserListEndpoint) {
    return "unavailable";
  }

  return "ready";
}

export function TicketAssignmentPanel({ ticket }: { ticket: FmTicketDetail }) {
  const { hasPermission } = usePermissions();
  const canAssign = hasPermission("fm_tickets.assign");
  const userManagementCapabilities = getUserManagementCapabilities();
  const userManagementDiscovery = getUserManagementEndpointDiscovery();
  const hasUserListEndpoint = Boolean(
    userManagementCapabilities.list && userManagementDiscovery.list,
  );
  const assignmentState = buildAssignmentState({
    canAssign,
    hasUserListEndpoint,
  });

  return (
    <SectionCard
      title="Assignment"
      description="The backend supports dedicated ticket assignment. The current assignee is always visible, and reassignment controls appear only when the account has assignment permission and a supported assignee source exists."
    >
      <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailField
          label="Current assignee"
          value={formatPersonLabel(ticket.assignee_email)}
        />
        <DetailField
          label="Assignment access"
          value={
            assignmentState === "ready"
              ? "Available"
              : assignmentState === "read_only"
                ? "Read only"
                : "Blocked by assignee source"
          }
        />
        <DetailField label="Permission" value="fm_tickets.assign" />
        <DetailField label="Endpoint" value={FM_TICKET_ASSIGNMENT_ENDPOINT} />
      </dl>

      {assignmentState === "read_only" ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="font-medium text-slate-900">Assignment is view only</p>
          <p className="mt-1 text-sm text-slate-700">
            This account can see the current assignee through
            {" "}
            <code>fm_tickets.view</code>
            {" "}
            but cannot change assignment without
            {" "}
            <code>fm_tickets.assign</code>.
          </p>
        </div>
      ) : null}

      {assignmentState === "unavailable" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-950">Assignment controls hidden</p>
          <p className="mt-1 text-sm text-amber-800">
            The backend assignment action is available, but the frontend does not
            currently have a supported users list endpoint to safely load assignee
            options. Current API discovery exposes
            {" "}
            <code>/api/auth/me/</code>
            {" "}
            for account context only, so assign and reassign controls stay hidden
            until a supported users collection endpoint is added.
          </p>
        </div>
      ) : null}
    </SectionCard>
  );
}
